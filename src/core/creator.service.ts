import { CreatorRepository } from './creator.repo';
import { UserRepository } from './user.repo';
import { ChannelRepository } from './channel.repo';
import prisma from '../db/prisma';

import { LoggerService } from './logger.service';
import { LedgerService } from './ledger.service';

const creatorRepo = new CreatorRepository();
const userRepo = new UserRepository();
const channelRepo = new ChannelRepository();
const ledgerService = new LedgerService();

const MIN_WITHDRAWAL = 10000;

export class CreatorService {
    async registerCreator(telegramId: bigint, username?: string, firstName?: string, lastName?: string) {
        // Upsert user
        const user = await userRepo.upsertUser(telegramId, username, firstName, lastName);

        // Check if creator exists, if not create
        let creator = await creatorRepo.findByUserId(user.id);
        if (!creator) {
            creator = await creatorRepo.createCreator(user.id) as any;
        }
        if (!creator) throw new Error("Failed to create creator");
        return creator;
    }

    async registerChannel(creatorUserId: number, channelTelegramId: bigint, title: string) {
        const creator = await creatorRepo.findByUserId(creatorUserId);
        if (!creator) throw new Error("Creator not found");

        // Check if channel already exists
        let channel = await channelRepo.findByTelegramId(channelTelegramId);
        if (channel) {
            if (channel.creatorId !== creator.id) throw new Error("Channel already registered by another creator");
            return channel;
        }

        return channelRepo.createChannel(creator.id, channelTelegramId, title);
    }

    async createPlan(channelDbId: number, name: string, price: number, duration: number) {
        return channelRepo.createPlan(channelDbId, name, price, duration);
    }

    async getBalance(telegramId: bigint) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) return 0;

        return ledgerService.getBalance(creator.id);
    }

    async requestPayout(telegramId: bigint, amount: number, cardNumber: string) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) throw new Error("Creator not found");

        const available = await ledgerService.getBalance(creator.id);

        if (amount < MIN_WITHDRAWAL) throw new Error("MIN_WITHDRAWAL_REQUIRED");
        if (amount > available) throw new Error("Insufficient balance");
        if (amount <= 0) throw new Error("Invalid amount");

        const payout = await prisma.$transaction(async (tx: any) => {
            // 1. Create Payout record
            const record = await tx.payout.create({
                data: {
                    creatorId: creator.id,
                    amount,
                    cardNumber,
                    status: 'REQUESTED'
                }
            });

            // 2. Deduct from balance
            await tx.creatorBalance.update({
                where: { creatorId: creator.id },
                data: {
                    availableBalance: { decrement: amount }
                }
            });

            return record;
        });

        // 3. Log Payout Request (Fail-safe)
        const user = await userRepo.findByTelegramId(telegramId);

        // Calculate total previously requested/paid
        const stats = await prisma.payout.aggregate({
            where: {
                creatorId: creator.id,
                status: { in: ['PAID', 'PROCESSING', 'REQUESTED'] },
                id: { not: payout.id } // Exclude current one for "already asked"
            },
            _sum: { amount: true }
        });
        const alreadyAsked = stats._sum.amount || 0;

        LoggerService.logPayoutRequest({
            payoutId: payout.id,
            telegramId,
            amount,
            cardNumber,
            username: user?.username ?? undefined,
            firstName: user?.firstName ?? undefined,
            lastName: user?.lastName ?? undefined,
            totalBalance: available - amount, // Balance after this withdrawal
            totalWithdrawn: alreadyAsked,     // Amount asked BEFORE this one
        }).catch(err => console.error("Non-blocking Logger Error:", err));

        return payout;
    }

    async getRecentPayouts(telegramId: bigint, days: number = 7) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) return [];

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return prisma.payout.findMany({
            where: {
                creatorId: creator.id,
                requestedAt: { gte: startDate }
            },
            orderBy: { requestedAt: 'desc' },
            take: 10
        });
    }

    async getPayoutHistory(telegramId: bigint) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) return [];

        return prisma.payout.findMany({
            where: { creatorId: creator.id },
            orderBy: { requestedAt: 'desc' },
            take: 50
        });
    }

    async getAnalytics(telegramId: bigint) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) throw new Error("Creator not found");

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 1. Total Revenue (Gross)
        const revenueStats = await prisma.transaction.aggregate({
            where: {
                subscription: { plan: { channel: { creatorId: creator.id } } },
                status: 'COMPLETED'
            },
            _sum: { grossAmount: true }
        });

        // 2. Active Subscribers
        const activeCount = await prisma.subscription.count({
            where: {
                plan: { channel: { creatorId: creator.id } },
                status: 'ACTIVE',
                endDate: { gt: now }
            }
        });

        // 3. Churn (Expired)
        const expiredCount = await prisma.subscription.count({
            where: {
                plan: { channel: { creatorId: creator.id } },
                status: 'EXPIRED'
            }
        });

        // 4. New Today
        const newTodayCount = await prisma.subscription.count({
            where: {
                plan: { channel: { creatorId: creator.id } },
                createdAt: { gte: startOfToday }
            }
        });

        // 5. Partner Result (Total unique users referred to this creator's channels)
        const referralSales = await prisma.transaction.aggregate({
            where: {
                subscription: { plan: { channel: { creatorId: creator.id } } },
                partnerShare: { gt: 0 }
            },
            _sum: { partnerShare: true },
            _count: { id: true }
        });

        return {
            totalRevenue: revenueStats._sum.grossAmount || 0,
            activeSubscribers: activeCount,
            totalChurn: expiredCount,
            newSubscribersToday: newTodayCount,
            partnerConversions: referralSales._count.id || 0,
            partnerPayouts: referralSales._sum.partnerShare || 0
        };
    }

    async getPartnerRequests(telegramId: bigint) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) return [];

        return prisma.partner.findMany({
            where: {
                channel: { creatorId: creator.id },
                status: 'PENDING'
            },
            include: {
                user: true,
                channel: true
            }
        });
    }

    async approvePartner(telegramId: bigint, partnerId: number, commissionRate: number = 0.40) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) throw new Error("Creator not found");

        // Verify ownership
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            include: { channel: true }
        });

        if (!partner || partner.channel.creatorId !== creator.id) {
            throw new Error("Unauthorized or partner not found");
        }

        return prisma.partner.update({
            where: { id: partnerId },
            data: {
                status: 'APPROVED',
                commissionRate
            },
            include: { user: true }
        });
    }

    async rejectPartner(telegramId: bigint, partnerId: number) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) throw new Error("Creator not found");

        const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            include: { channel: true }
        });

        if (!partner || partner.channel.creatorId !== creator.id) {
            throw new Error("Unauthorized or partner not found");
        }

        return prisma.partner.update({
            where: { id: partnerId },
            data: { status: 'REJECTED' }
        });
    }

    async getChannelPartners(telegramId: bigint, channelId: number) {
        const creator = await creatorRepo.findByTelegramId(telegramId);
        if (!creator) return [];

        return prisma.partner.findMany({
            where: {
                channelId,
                channel: { creatorId: creator.id },
                status: 'APPROVED'
            },
            include: { user: true }
        });
    }
}
