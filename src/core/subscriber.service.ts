import { ChannelRepository } from './channel.repo';
import { SubscriptionRepository } from './subscription.repo';
import { UserRepository } from './user.repo';
import prisma from '../db/prisma';

const channelRepo = new ChannelRepository();
const subRepo = new SubscriptionRepository();
const userRepo = new UserRepository();

export class SubscriberService {
    async registerUser(telegramId: bigint, username?: string, firstName?: string, lastName?: string, language?: string) {
        return userRepo.upsertUser(telegramId, username, firstName, lastName, language);
    }

    async getChannelDetails(channelId: number) {
        return channelRepo.findById(channelId);
    }

    async getSubscription(userId: bigint, channelId: number) {
        const user = await userRepo.findByTelegramId(userId);
        if (!user) return null;

        const sub = user.subscriptions.find((s: any) => s.plan?.channelId === channelId && s.status === 'ACTIVE');
        return sub;
    }

    async activateSubscription(
        userId: bigint, 
        planId: number, 
        paymentId: string, 
        api: any, 
        userData?: { username?: string, firstName?: string, lastName?: string },
        referrerId?: bigint
    ) {
        // 1. Fetch Plan
        const plan = await subRepo.findPlanById(planId); 
        if (!plan) throw new Error("Plan not found");

        const channelTelegramId = plan.channel.telegramChannelId;

        // 2. Create Invite Link
        const invite = await api.createChatInviteLink(Number(channelTelegramId), {
            member_limit: 1,
            name: `Sub for User ${userId}`
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
                            channelId: plan.channelId
                        }
                    }
                });
                
                if (partnerRecord && partnerRecord.status === 'APPROVED') {
                    partnerId = partnerRecord.id;
                }
            }
        }

        // 5. Create Subscription
        const sub = await subRepo.createActiveSubscription(
            user.id, planId, paymentId, startDate, endDate, invite.invite_link, partnerId
        );

        return sub;
    }

    async getPlan(planId: number) {
        return subRepo.findPlanById(planId);
    }

    async requestPartnership(telegramId: bigint, channelId: number) {
        const user = await userRepo.findByTelegramId(telegramId);
        if (!user) throw new Error("User not found");

        // Check if already exists
        const existing = await prisma.partner.findUnique({
            where: {
                userId_channelId: {
                    userId: user.id,
                    channelId
                }
            }
        });

        if (existing) return existing;

        return prisma.partner.create({
            data: {
                userId: user.id,
                channelId,
                status: 'PENDING'
            }
        });
    }
}
