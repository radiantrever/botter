"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = exports.FEES = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
exports.FEES = {
    PROVIDER_PERCENT: 0.05, // 5% Tip: TsPay
    PLATFORM_PERCENT: 0.05, // 5% Tip: Our share
};
class LedgerService {
    // Calculate shares based on gross amount
    // Partner commission is calculated from remaining amount after fees
    calculateFees(grossAmount, platformPercent, partnerPercent = 0) {
        const providerFee = Math.floor(grossAmount * exports.FEES.PROVIDER_PERCENT);
        const platformFee = Math.floor(grossAmount * platformPercent);
        // Calculate remaining amount after TsPay and platform fees
        const amountAfterFees = grossAmount - providerFee - platformFee;
        // Partner gets percentage of the remaining amount
        const partnerShare = Math.floor(amountAfterFees * partnerPercent);
        const creatorShare = amountAfterFees - partnerShare;
        return {
            grossAmount,
            providerFee,
            platformFee,
            partnerShare,
            creatorShare,
        };
    }
    async recordTransaction(subscriptionId, grossAmount, creatorId) {
        // Fetch subscription and linked partner
        const subscription = await prisma_1.default.subscription.findUnique({
            where: { id: subscriptionId },
            include: {
                user: true,
                partner: true,
                plan: { include: { channel: true } },
            },
        });
        const channel = subscription?.plan?.channel;
        const platformPercent = channel?.commissionRate ?? exports.FEES.PLATFORM_PERCENT;
        // Only apply partner commission if the partner is APPROVED
        const partner = subscription?.partner?.status === 'APPROVED'
            ? subscription.partner
            : null;
        const partnerPercent = partner?.commissionRate ?? 0;
        const { providerFee, platformFee, partnerShare, creatorShare } = this.calculateFees(grossAmount, platformPercent, partnerPercent);
        return prisma_1.default.$transaction(async (tx) => {
            // 1. Create Transaction Record
            const transaction = await tx.transaction.create({
                data: {
                    subscriptionId,
                    grossAmount,
                    providerFee,
                    platformFee,
                    partnerShare,
                    creatorShare,
                    partnerId: partner?.id,
                    status: 'COMPLETED',
                },
            });
            // 2. Update Creator Balance (Channel Owner)
            await tx.creatorBalance.upsert({
                where: { creatorId },
                update: { availableBalance: { increment: creatorShare } },
                create: { creatorId, availableBalance: creatorShare },
            });
            // 3. Update Partner Balance (if applicable)
            if (partnerShare > 0 && partner) {
                let partnerCreator = await tx.creator.findUnique({
                    where: { userId: partner.userId },
                });
                if (!partnerCreator) {
                    partnerCreator = await tx.creator.create({
                        data: { userId: partner.userId },
                    });
                }
                await tx.creatorBalance.upsert({
                    where: { creatorId: partnerCreator.id },
                    update: { availableBalance: { increment: partnerShare } },
                    create: {
                        creatorId: partnerCreator.id,
                        availableBalance: partnerShare,
                    },
                });
            }
            return transaction;
        });
    }
    async getBalance(creatorId) {
        const balance = await prisma_1.default.creatorBalance.findUnique({
            where: { creatorId },
        });
        return balance?.availableBalance || 0;
    }
}
exports.LedgerService = LedgerService;
