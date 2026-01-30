"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriberService = void 0;
const channel_repo_1 = require("./channel.repo");
const subscription_repo_1 = require("./subscription.repo");
const user_repo_1 = require("./user.repo");
const prisma_1 = __importDefault(require("../db/prisma"));
const channelRepo = new channel_repo_1.ChannelRepository();
const subRepo = new subscription_repo_1.SubscriptionRepository();
const userRepo = new user_repo_1.UserRepository();
class SubscriberService {
    async registerUser(telegramId, username, firstName, lastName, language) {
        return userRepo.upsertUser(telegramId, username, firstName, lastName, language);
    }
    async getChannelDetails(channelId) {
        return channelRepo.findById(channelId);
    }
    async getSubscription(userId, channelId) {
        const user = await userRepo.findByTelegramId(userId);
        if (!user)
            return null;
        const sub = user.subscriptions.find((s) => s.plan?.channelId === channelId && s.status === 'ACTIVE');
        return sub;
    }
    async activateSubscription(userId, planId, paymentId, api, userData, referrerId) {
        // 1. Fetch Plan
        const plan = await subRepo.findPlanById(planId);
        if (!plan)
            throw new Error('Plan not found');
        const channelTelegramId = plan.channel.telegramChannelId;
        // 2. Create Invite Link
        const invite = await api.createChatInviteLink(Number(channelTelegramId), {
            member_limit: 1,
            name: `Sub for User ${userId}`,
        });
        // 3. Ensure User Record exists
        const user = await userRepo.upsertUser(userId, userData?.username, userData?.firstName, userData?.lastName);
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + plan.durationDay);
        // 4. Check Referral/Partner
        let partnerId;
        if (referrerId && referrerId !== userId) {
            const referrerUser = await userRepo.findByTelegramId(referrerId);
            if (referrerUser) {
                // Check if they are an APPROVED partner for this channel
                const partnerRecord = await prisma_1.default.partner.findUnique({
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
        const sub = await subRepo.createActiveSubscription(user.id, planId, paymentId, startDate, endDate, invite.invite_link, partnerId);
        return sub;
    }
    async getPlan(planId) {
        return subRepo.findPlanById(planId);
    }
    async requestPartnership(telegramId, channelId) {
        const user = await userRepo.findByTelegramId(telegramId);
        if (!user)
            throw new Error('User not found');
        // Check if already exists
        const existing = await prisma_1.default.partner.findUnique({
            where: {
                userId_channelId: {
                    userId: user.id,
                    channelId,
                },
            },
        });
        if (existing)
            return existing;
        return prisma_1.default.partner.create({
            data: {
                userId: user.id,
                channelId,
                status: 'PENDING',
            },
        });
    }
}
exports.SubscriberService = SubscriberService;
