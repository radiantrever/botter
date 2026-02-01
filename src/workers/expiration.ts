import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { SubscriptionRepository } from '../core/subscription.repo';
import { PreviewRepository } from '../core/preview.repo';
import { bot } from '../bot/bot';
import { Language, t } from '../bot/i18n';
import { LoggerService } from '../core/logger.service';
import prisma from '../db/prisma';

const subRepo = new SubscriptionRepository();
const previewRepo = new PreviewRepository();
const TASHKENT_OFFSET_MINUTES = 300;
let lastAnalyticsKey: string | null = null;

/**
 * Checks for expired subscriptions and kicks users.
 * This function can be called by a BullMQ worker or a simple setInterval.
 */
export async function checkExpirations() {
  console.log('Worker: Checking expirations and reminders...');
  try {
    await enforcePreviewExpirations();

    // 1. Kicking expired users
    const expiredSubs = await subRepo.findExpiredActiveSubscriptions();
    if (expiredSubs.length > 0) {
      console.log(`Worker: Found ${expiredSubs.length} expired subscriptions.`);
      for (const sub of expiredSubs) {
        try {
          const channelId = sub.plan.channel.telegramChannelId;
          const userId = sub.user.telegramId;
          const lang = ((sub.user as any).language as Language) || 'en';

          await bot.api.banChatMember(Number(channelId), Number(userId));
          await bot.api.unbanChatMember(Number(channelId), Number(userId));

          if (sub.inviteLink) {
            await bot.api
              .revokeChatInviteLink(Number(channelId), sub.inviteLink)
              .catch(() => {});
          }

          await subRepo.expireSubscription(sub.id);
          const message = t(lang, 'sub_expired', {
            channel: sub.plan.channel.title,
          });
          await bot.api
            .sendMessage(Number(userId), message, { parse_mode: 'Markdown' })
            .catch(() => {});

          await LoggerService.logEvent(
            `🚪 **USER KICKED (EXPIRED)**\n\n` +
              `👤 **User:** ${sub.user.firstName || ''} (${sub.user.username ? '@' + sub.user.username : 'No username'})\n` +
              `🆔 **ID:** \`${userId}\`\n` +
              `📢 **Channel:** ${sub.plan.channel.title}\n` +
              `📅 **Expired At:** \`${sub.endDate?.toLocaleString()}\``
          ).catch((err: any) =>
            console.error('Failed to log kick to admin channel:', err)
          );

          console.log(
            `Worker: Successfully processed expiration for user ${userId}`
          );
        } catch (e: any) {
          console.error(
            `Worker: Failed to enforce expiration for sub ${sub.id}:`,
            e.message
          );
        }
      }
    }

    // 2. Sending Reminders (3 days and 1 day)
    await sendReminders(3, 'reminder_3d');
    await sendReminders(1, 'reminder_1d');
  } catch (globalErr) {
    console.error('Worker: Global error in checkExpirations:', globalErr);
  }
}

async function enforcePreviewExpirations() {
  try {
    const expiredPreviews = await previewRepo.findExpiredActivePreviews();
    if (expiredPreviews.length === 0) return;

    console.log(`Worker: Found ${expiredPreviews.length} expired previews.`);

    for (const preview of expiredPreviews) {
      try {
        const hasActiveSub = await subRepo.hasActiveSubscription(
          preview.userId,
          preview.channelId
        );

        if (hasActiveSub) {
          await previewRepo.updateStatus(preview.id, 'CONVERTED');
          continue;
        }

        const channelId = preview.channel.telegramChannelId;
        const userId = preview.user.telegramId;
        const lang = ((preview.user as any).language as Language) || 'en';

        await bot.api.banChatMember(Number(channelId), Number(userId));
        await bot.api.unbanChatMember(Number(channelId), Number(userId));

        if (preview.inviteLink) {
          await bot.api
            .revokeChatInviteLink(Number(channelId), preview.inviteLink)
            .catch(() => {});
        }

        await previewRepo.updateStatus(preview.id, 'EXPIRED');

        const message = t(lang, 'preview_expired', {
          channel: preview.channel.title,
        });
        await bot.api
          .sendMessage(Number(userId), message, { parse_mode: 'Markdown' })
          .catch(() => {});

        console.log(
          `Worker: Preview expired for user ${userId} in channel ${preview.channelId}`
        );
      } catch (e: any) {
        console.error(
          `Worker: Failed to enforce preview expiration ${preview.id}:`,
          e.message
        );
      }
    }
  } catch (e) {
    console.error('Worker: Failed to process preview expirations:', e);
  }
}

async function sendReminders(
  days: number,
  translationKey: 'reminder_1d' | 'reminder_3d'
) {
  try {
    const subs = await subRepo.findSubscriptionsForReminder(days);
    for (const sub of subs) {
      const lang = ((sub.user as any).language as Language) || 'en';
      const message = t(lang, translationKey, {
        channel: sub.plan.channel.title,
      });

      await bot.api
        .sendMessage(Number(sub.user.telegramId), message, {
          parse_mode: 'Markdown',
        })
        .then(async () => {
          await subRepo.updateReminderFlag(sub.id, days);
          console.log(
            `Worker: Sent ${days}-day reminder to user ${sub.user.telegramId}`
          );
        })
        .catch(err => {
          if (err.description?.includes('bot was blocked')) {
            // Optional: mark as reminded to stop trying
            subRepo.updateReminderFlag(sub.id, days).catch(() => {});
          }
        });
    }
  } catch (e) {
    console.error(`Worker: Failed to send ${days}-day reminders:`, e);
  }
}

// Optional: BullMQ Worker if infrastructure is available
const redisConnection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    };

export const expirationWorker = new Worker(
  'expiration-queue',
  async _job => {
    await checkExpirations();
  },
  {
    connection: redisConnection,
  }
);

// For immediate fail-safe without requiring Redis/BullMQ during dev/simple VPS:
export function startExpirationCron(intervalMs: number = 60 * 1000) {
  console.log(
    `Worker: Starting expiration cron every ${intervalMs / 1000 / 60} minutes.`
  );
  setInterval(async () => {
    await checkExpirations();
  }, intervalMs);
}

function getTashkentParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function getStartOfDayTashkent(parts: {
  year: number;
  month: number;
  day: number;
}) {
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  return new Date(utcMidnight - TASHKENT_OFFSET_MINUTES * 60 * 1000);
}

async function sendDailyAnalyticsReport(now: Date) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;

  const parts = getTashkentParts(now);
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const isReportHour = (parts.hour === 6 || parts.hour === 18) && parts.minute === 0;
  if (!isReportHour) return;

  const runKey = `${dateKey}-${String(parts.hour).padStart(2, '0')}`;
  if (lastAnalyticsKey === runKey) return;
  lastAnalyticsKey = runKey;

  const startOfDay = getStartOfDayTashkent(parts);
  const nowDate = new Date();

  const [
    totalUsers,
    totalCreators,
    totalChannels,
    freeChannels,
    totalBundles,
    totalPlans,
    totalBundlePlans,
    activeSubs,
    expiredSubs,
    newSubsToday,
    newUsersToday,
    txStats,
    bundleTxStats,
    txToday,
    bundleTxToday,
    payoutsRequested,
    payoutsPaid,
    payoutsRequestedToday,
    payoutsPaidToday,
    totalBalances,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.creator.count(),
    prisma.channel.count(),
    prisma.channel.count({ where: { isFree: true } }),
    prisma.bundle.count(),
    prisma.subscriptionPlan.count(),
    prisma.bundlePlan.count(),
    prisma.subscription.count({
      where: { status: 'ACTIVE', endDate: { gt: nowDate } },
    }),
    prisma.subscription.count({ where: { status: 'EXPIRED' } }),
    prisma.subscription.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: {
        grossAmount: true,
        providerFee: true,
        platformFee: true,
        partnerShare: true,
        creatorShare: true,
      },
      _count: { _all: true },
    }),
    prisma.bundleTransaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: {
        grossAmount: true,
        providerFee: true,
        platformFee: true,
        creatorShare: true,
      },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: startOfDay } },
      _sum: {
        grossAmount: true,
        providerFee: true,
        platformFee: true,
        partnerShare: true,
        creatorShare: true,
      },
      _count: { _all: true },
    }),
    prisma.bundleTransaction.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: startOfDay } },
      _sum: {
        grossAmount: true,
        providerFee: true,
        platformFee: true,
        creatorShare: true,
      },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: { status: { in: ['REQUESTED', 'PROCESSING'] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: {
        status: { in: ['REQUESTED', 'PROCESSING'] },
        requestedAt: { gte: startOfDay },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: { status: 'PAID', processedAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.creatorBalance.aggregate({
      _sum: { availableBalance: true },
    }),
  ]);

  const totalGross =
    (txStats._sum.grossAmount || 0) + (bundleTxStats._sum.grossAmount || 0);
  const totalProvider =
    (txStats._sum.providerFee || 0) + (bundleTxStats._sum.providerFee || 0);
  const totalPlatform =
    (txStats._sum.platformFee || 0) + (bundleTxStats._sum.platformFee || 0);
  const totalPartner = txStats._sum.partnerShare || 0;
  const totalCreator =
    (txStats._sum.creatorShare || 0) + (bundleTxStats._sum.creatorShare || 0);
  const todayGross =
    (txToday._sum.grossAmount || 0) + (bundleTxToday._sum.grossAmount || 0);
  const todayProvider =
    (txToday._sum.providerFee || 0) + (bundleTxToday._sum.providerFee || 0);
  const todayPlatform =
    (txToday._sum.platformFee || 0) + (bundleTxToday._sum.platformFee || 0);
  const todayPartner = txToday._sum.partnerShare || 0;
  const todayCreator =
    (txToday._sum.creatorShare || 0) + (bundleTxToday._sum.creatorShare || 0);
  const totalAvailable = totalBalances._sum.availableBalance || 0;

  const message =
    `📊 **Daily Bot Analytics**\n` +
    `🕕 **Time:** ${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:00 (GMT+5)\n\n` +
    `👥 **Users:** ${totalUsers.toLocaleString()} (new today: ${newUsersToday.toLocaleString()})\n` +
    `🧑‍💼 **Creators:** ${totalCreators.toLocaleString()}\n` +
    `📺 **Channels:** ${totalChannels.toLocaleString()} (free: ${freeChannels.toLocaleString()})\n` +
    `📦 **Bundles:** ${totalBundles.toLocaleString()}\n` +
    `🏷 **Plans:** ${totalPlans.toLocaleString()} (bundle plans: ${totalBundlePlans.toLocaleString()})\n\n` +
    `✅ **Active Subs:** ${activeSubs.toLocaleString()}\n` +
    `⌛ **Expired Subs:** ${expiredSubs.toLocaleString()}\n` +
    `🆕 **New Subs Today:** ${newSubsToday.toLocaleString()}\n\n` +
    `💳 **Transactions:** ${(txStats._count._all || 0).toLocaleString()} (bundles: ${(bundleTxStats._count._all || 0).toLocaleString()})\n` +
    `💰 **Gross:** ${totalGross.toLocaleString()} UZS\n` +
    `🏦 **Provider Fee:** ${totalProvider.toLocaleString()} UZS\n` +
    `🏷 **Platform Fee:** ${totalPlatform.toLocaleString()} UZS\n` +
    `🤝 **Partner Share:** ${totalPartner.toLocaleString()} UZS\n` +
    `👑 **Creator Share:** ${totalCreator.toLocaleString()} UZS\n` +
    `💼 **Total Available Balances:** ${totalAvailable.toLocaleString()} UZS\n\n` +
    `📆 **Today Financials**\n` +
    `💰 **Gross Today:** ${todayGross.toLocaleString()} UZS\n` +
    `🏦 **Provider Fee Today:** ${todayProvider.toLocaleString()} UZS\n` +
    `🏷 **Platform Fee Today:** ${todayPlatform.toLocaleString()} UZS\n` +
    `🤝 **Partner Share Today:** ${todayPartner.toLocaleString()} UZS\n` +
    `👑 **Creator Share Today:** ${todayCreator.toLocaleString()} UZS\n\n` +
    `💸 **Payouts Pending:** ${(payoutsRequested._count._all || 0).toLocaleString()} (${(payoutsRequested._sum.amount || 0).toLocaleString()} UZS)\n` +
    `✅ **Payouts Paid:** ${(payoutsPaid._count._all || 0).toLocaleString()} (${(payoutsPaid._sum.amount || 0).toLocaleString()} UZS)\n` +
    `🆕 **Payouts Pending Today:** ${(payoutsRequestedToday._count._all || 0).toLocaleString()} (${(payoutsRequestedToday._sum.amount || 0).toLocaleString()} UZS)\n` +
    `🆕 **Payouts Paid Today:** ${(payoutsPaidToday._count._all || 0).toLocaleString()} (${(payoutsPaidToday._sum.amount || 0).toLocaleString()} UZS)`;

  await bot.api.sendMessage(logChannelId, message, { parse_mode: 'Markdown' });
}

export function startDailyAnalyticsCron(intervalMs: number = 60 * 1000) {
  console.log(
    `Worker: Starting daily analytics cron every ${intervalMs / 1000 / 60} minutes.`
  );
  setInterval(async () => {
    try {
      await sendDailyAnalyticsReport(new Date());
    } catch (e) {
      console.error('Worker: Failed to send daily analytics:', e);
    }
  }, intervalMs);
}
