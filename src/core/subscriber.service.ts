import { ChannelRepository } from './channel.repo';
import { SubscriptionRepository } from './subscription.repo';
import { UserRepository } from './user.repo';
import { PreviewRepository } from './preview.repo';
import prisma from '../db/prisma';

const channelRepo = new ChannelRepository();
const subRepo = new SubscriptionRepository();
const userRepo = new UserRepository();
const previewRepo = new PreviewRepository();

const MAX_PREVIEW_MINUTES = 15;
const PREVIEW_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export class SubscriberService {
  async registerUser(
    telegramId: bigint,
    username?: string,
    firstName?: string,
    lastName?: string,
    language?: string
  ) {
    return userRepo.upsertUser(
      telegramId,
      username,
      firstName,
      lastName,
      language
    );
  }

  async getChannelDetails(channelId: number) {
    return channelRepo.findById(channelId);
  }

  async getSubscription(userId: bigint, channelId: number) {
    const user = await userRepo.findByTelegramId(userId);
    if (!user) return null;

    const sub = user.subscriptions.find(
      (s: any) => s.plan?.channelId === channelId && s.status === 'ACTIVE'
    );
    return sub;
  }

  async activateSubscription(
    userId: bigint,
    planId: number,
    paymentId: string,
    api: any,
    userData?: { username?: string; firstName?: string; lastName?: string },
    referrerId?: bigint
  ) {
    // 1. Fetch Plan
    const plan = await subRepo.findPlanById(planId);
    if (!plan) throw new Error('Plan not found');

    const channelTelegramId = plan.channel.telegramChannelId;

    // 2. Create Invite Link
    const invite = await api.createChatInviteLink(Number(channelTelegramId), {
      member_limit: 1,
      name: `Sub for User ${userId}`,
    });

    // 3. Ensure User Record exists
    const user = await userRepo.upsertUser(
      userId,
      userData?.username,
      userData?.firstName,
      userData?.lastName
    );

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.durationDay);

    // 4. Check Referral/Partner
    let partnerId: number | undefined;
    if (referrerId && referrerId !== userId) {
      const referrerUser = await userRepo.findByTelegramId(referrerId);
      if (referrerUser) {
        // Check if they are an APPROVED partner for this channel
        const partnerRecord = await prisma.partner.findUnique({
          where: {
            userId_channelId: {
              userId: referrerUser.id,
              channelId: plan.channelId,
            },
          },
        });

        if (partnerRecord && partnerRecord.status === 'APPROVED') {
          partnerId = partnerRecord.id;
        }
      }
    }

    // 5. Create Subscription
    const sub = await subRepo.createActiveSubscription(
      user.id,
      planId,
      paymentId,
      startDate,
      endDate,
      invite.invite_link,
      partnerId
    );

    await previewRepo.markConvertedByUserChannel(user.id, plan.channelId);

    return sub;
  }

  async startPreview(
    userId: bigint,
    channelId: number,
    api: any,
    userData?: { username?: string; firstName?: string; lastName?: string }
  ) {
    const channel = await channelRepo.findById(channelId);
    if (!channel) throw new Error('CHANNEL_NOT_FOUND');

    if (!channel.previewEnabled || channel.previewDurationMin < 1) {
      throw new Error('PREVIEW_DISABLED');
    }

    const duration = Math.min(channel.previewDurationMin, MAX_PREVIEW_MINUTES);

    const user = await userRepo.upsertUser(
      userId,
      userData?.username,
      userData?.firstName,
      userData?.lastName
    );

    const hasActiveSub = await subRepo.hasActiveSubscription(user.id, channelId);
    if (hasActiveSub) throw new Error('ALREADY_SUBSCRIBED');

    const existingPreview = await previewRepo.findActivePreviewByUserChannel(
      user.id,
      channelId
    );
    if (existingPreview) {
      return { preview: existingPreview, channel, duration };
    }

    const latestPreview = await previewRepo.findLatestPreviewByUserChannel(
      user.id,
      channelId
    );
    if (latestPreview) {
      const cooldownEnd = new Date(
        latestPreview.endDate.getTime() + PREVIEW_COOLDOWN_DAYS * DAY_MS
      );
      if (cooldownEnd.getTime() > Date.now()) {
        const remainingDays = Math.ceil(
          (cooldownEnd.getTime() - Date.now()) / DAY_MS
        );
        const err = new Error('PREVIEW_COOLDOWN') as Error & {
          remainingDays?: number;
        };
        err.remainingDays = remainingDays;
        throw err;
      }
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

    const invite = await api.createChatInviteLink(
      Number(channel.telegramChannelId),
      {
        member_limit: 1,
        expire_date: Math.floor(endDate.getTime() / 1000),
        name: `Preview for ${userId}`,
      }
    );

    const preview = await previewRepo.createPreviewAccess(
      user.id,
      channelId,
      startDate,
      endDate,
      invite.invite_link
    );

    return { preview, channel, duration };
  }

  async getPlan(planId: number) {
    return subRepo.findPlanById(planId);
  }

  async getBundleDetails(bundleId: number) {
    return prisma.bundle.findUnique({
      where: { id: bundleId },
      include: {
        plans: { where: { isActive: true } },
        channels: { include: { channel: true } },
      },
    });
  }

  async getBundlePlan(planId: number) {
    return prisma.bundlePlan.findUnique({
      where: { id: planId },
      include: {
        bundle: {
          include: {
            channels: { include: { channel: true } },
            creator: true,
          },
        },
      },
    });
  }

  async activateBundleSubscription(
    userId: bigint,
    planId: number,
    paymentId: string,
    api: any,
    userData?: { username?: string; firstName?: string; lastName?: string }
  ) {
    const plan = await this.getBundlePlan(planId);
    if (!plan) throw new Error('Plan not found');

    const bundle = plan.bundle;
    const channels = bundle.channels.map(item => item.channel);

    const user = await userRepo.upsertUser(
      userId,
      userData?.username,
      userData?.firstName,
      userData?.lastName
    );

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.durationDay);

    const inviteLinks: Array<{
      channelId: number;
      channelTitle: string;
      inviteLink?: string;
      error?: string;
    }> = [];

    for (const channel of channels) {
      try {
        const invite = await api.createChatInviteLink(
          Number(channel.telegramChannelId),
          {
            member_limit: 1,
            name: `Bundle ${bundle.id} for ${userId}`,
          }
        );
        inviteLinks.push({
          channelId: channel.id,
          channelTitle: channel.title,
          inviteLink: invite.invite_link,
        });
      } catch (err: any) {
        inviteLinks.push({
          channelId: channel.id,
          channelTitle: channel.title,
          error: err?.description || 'Failed to create invite link',
        });
      }
    }

    const subscription = await prisma.bundleSubscription.create({
      data: {
        userId: user.id,
        planId,
        bundleId: bundle.id,
        paymentId,
        status: 'ACTIVE',
        startDate,
        endDate,
        inviteLinks,
      },
      include: { plan: { include: { bundle: true } } },
    });

    return { subscription, inviteLinks, bundle };
  }

  async requestPartnership(telegramId: bigint, channelId: number) {
    const user = await userRepo.findByTelegramId(telegramId);
    if (!user) throw new Error('User not found');

    // Check if already exists
    const existing = await prisma.partner.findUnique({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId,
        },
      },
    });

    if (existing) return existing;

    return prisma.partner.create({
      data: {
        userId: user.id,
        channelId,
        status: 'PENDING',
      },
    });
  }
}
