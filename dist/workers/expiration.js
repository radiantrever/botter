"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expirationWorker = void 0;
exports.checkExpirations = checkExpirations;
exports.startExpirationCron = startExpirationCron;
const bullmq_1 = require("bullmq");
const subscription_repo_1 = require("../core/subscription.repo");
const bot_1 = require("../bot/bot");
const i18n_1 = require("../bot/i18n");
const subRepo = new subscription_repo_1.SubscriptionRepository();
/**
 * Checks for expired subscriptions and kicks users.
 * This function can be called by a BullMQ worker or a simple setInterval.
 */
async function checkExpirations() {
    console.log("Worker: Checking expirations and reminders...");
    try {
        // 1. Kicking expired users
        const expiredSubs = await subRepo.findExpiredActiveSubscriptions();
        if (expiredSubs.length > 0) {
            console.log(`Worker: Found ${expiredSubs.length} expired subscriptions.`);
            for (const sub of expiredSubs) {
                try {
                    const channelId = sub.plan.channel.telegramChannelId;
                    const userId = sub.user.telegramId;
                    const lang = sub.user.language || 'en';
                    await bot_1.bot.api.banChatMember(Number(channelId), Number(userId));
                    await bot_1.bot.api.unbanChatMember(Number(channelId), Number(userId));
                    if (sub.inviteLink) {
                        await bot_1.bot.api.revokeChatInviteLink(Number(channelId), sub.inviteLink).catch(() => { });
                    }
                    await subRepo.expireSubscription(sub.id);
                    const message = (0, i18n_1.t)(lang, "sub_expired", { channel: sub.plan.channel.title });
                    await bot_1.bot.api.sendMessage(Number(userId), message, { parse_mode: "Markdown" }).catch(() => { });
                    const { LoggerService } = require('../core/logger.service');
                    await LoggerService.logEvent(`🚪 **USER KICKED (EXPIRED)**\n\n` +
                        `👤 **User:** ${sub.user.firstName || ''} (${sub.user.username ? '@' + sub.user.username : 'No username'})\n` +
                        `🆔 **ID:** \`${userId}\`\n` +
                        `📢 **Channel:** ${sub.plan.channel.title}\n` +
                        `📅 **Expired At:** \`${sub.endDate?.toLocaleString()}\``).catch((err) => console.error("Failed to log kick to admin channel:", err));
                    console.log(`Worker: Successfully processed expiration for user ${userId}`);
                }
                catch (e) {
                    console.error(`Worker: Failed to enforce expiration for sub ${sub.id}:`, e.message);
                }
            }
        }
        // 2. Sending Reminders (3 days and 1 day)
        await sendReminders(3, "reminder_3d");
        await sendReminders(1, "reminder_1d");
    }
    catch (globalErr) {
        console.error("Worker: Global error in checkExpirations:", globalErr);
    }
}
async function sendReminders(days, translationKey) {
    try {
        const subs = await subRepo.findSubscriptionsForReminder(days);
        for (const sub of subs) {
            const lang = sub.user.language || 'en';
            const message = (0, i18n_1.t)(lang, translationKey, { channel: sub.plan.channel.title });
            await bot_1.bot.api.sendMessage(Number(sub.user.telegramId), message, { parse_mode: "Markdown" })
                .then(async () => {
                await subRepo.updateReminderFlag(sub.id, days);
                console.log(`Worker: Sent ${days}-day reminder to user ${sub.user.telegramId}`);
            })
                .catch(err => {
                if (err.description?.includes("bot was blocked")) {
                    // Optional: mark as reminded to stop trying
                    subRepo.updateReminderFlag(sub.id, days).catch(() => { });
                }
            });
        }
    }
    catch (e) {
        console.error(`Worker: Failed to send ${days}-day reminders:`, e);
    }
}
// Optional: BullMQ Worker if infrastructure is available
exports.expirationWorker = new bullmq_1.Worker('expiration-queue', async (job) => {
    await checkExpirations();
}, {
    connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379')
    }
});
// For immediate fail-safe without requiring Redis/BullMQ during dev/simple VPS:
function startExpirationCron(intervalMs = 60 * 60 * 1000) {
    console.log(`Worker: Starting expiration cron every ${intervalMs / 1000 / 60} minutes.`);
    setInterval(async () => {
        await checkExpirations();
    }, intervalMs);
}
