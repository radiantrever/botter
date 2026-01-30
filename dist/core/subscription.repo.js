"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRepository = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
// import { SubscriptionStatus } from '@prisma/client'; // Removed for SQLite compat
class SubscriptionRepository {
    async createSubscription(userId, planId, paymentId) {
        return prisma_1.default.subscription.create({
            data: {
                user: { connect: { id: userId } },
                plan: { connect: { id: planId } },
                paymentId,
                status: 'PENDING',
            },
        });
    }
    async activateSubscription(id, startDate, endDate, inviteLink) {
        return prisma_1.default.subscription.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                startDate,
                endDate,
                inviteLink,
            },
        });
    }
    async findExpiredActiveSubscriptions() {
        return prisma_1.default.subscription.findMany({
            where: {
                status: 'ACTIVE',
                endDate: { lt: new Date() },
            },
            include: { user: true, plan: { include: { channel: true } } },
        });
    }
    async findSubscriptionsForReminder(daysRemaining) {
        const now = new Date();
        const reminderDate = new Date();
        reminderDate.setDate(now.getDate() + daysRemaining);
        // Window of 1 hour to avoid missing someone but also avoid spamming if cron runs multiple times
        // Actually, we use flags (reminded1d, reminded3d) to ensure exactly once.
        const flagField = daysRemaining === 1 ? 'reminded1d' : 'reminded3d';
        return prisma_1.default.subscription.findMany({
            where: {
                status: 'ACTIVE',
                endDate: { lte: reminderDate },
                [flagField]: false
            },
            include: { user: true, plan: { include: { channel: true } } }
        });
    }
    async updateReminderFlag(id, daysRemaining) {
        const flagField = daysRemaining === 1 ? 'reminded1d' : 'reminded3d';
        return prisma_1.default.subscription.update({
            where: { id },
            data: { [flagField]: true }
        });
    }
    async expireSubscription(id) {
        return prisma_1.default.subscription.update({
            where: { id },
            data: { status: 'EXPIRED' },
        });
    }
    async findPlanById(planId) {
        return prisma_1.default.subscriptionPlan.findUnique({
            where: { id: planId },
            include: { channel: true }
        });
    }
    async createActiveSubscription(userId, planId, paymentId, startDate, endDate, inviteLink, partnerId) {
        return prisma_1.default.subscription.create({
            data: {
                userId,
                planId,
                paymentId,
                status: 'ACTIVE',
                startDate,
                endDate,
                inviteLink,
                partnerId
            }
        });
    }
}
exports.SubscriptionRepository = SubscriptionRepository;
