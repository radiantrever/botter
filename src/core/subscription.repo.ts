import prisma from '../db/prisma';
// import { SubscriptionStatus } from '@prisma/client'; // Removed for SQLite compat

export class SubscriptionRepository {
  async createSubscription(userId: number, planId: number, paymentId: string) {
    return prisma.subscription.create({
      data: {
        user: { connect: { id: userId } },
        plan: { connect: { id: planId } },
        paymentId,
        status: 'PENDING',
      },
    });
  }

  async activateSubscription(
    id: number,
    startDate: Date,
    endDate: Date,
    inviteLink: string
  ) {
    return prisma.subscription.update({
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
    return prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: new Date() },
      },
      include: { user: true, plan: { include: { channel: true } } },
    });
  }

  async findSubscriptionsForReminder(daysRemaining: number) {
    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(now.getDate() + daysRemaining);

    // Window of 1 hour to avoid missing someone but also avoid spamming if cron runs multiple times
    // Actually, we use flags (reminded1d, reminded3d) to ensure exactly once.
    const flagField = daysRemaining === 1 ? 'reminded1d' : 'reminded3d';

    return prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: reminderDate },
        [flagField]: false,
      },
      include: { user: true, plan: { include: { channel: true } } },
    });
  }

  async updateReminderFlag(id: number, daysRemaining: number) {
    const flagField = daysRemaining === 1 ? 'reminded1d' : 'reminded3d';
    return prisma.subscription.update({
      where: { id },
      data: { [flagField]: true },
    });
  }

  async expireSubscription(id: number) {
    return prisma.subscription.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }

  async findPlanById(planId: number) {
    return prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: { channel: true },
    });
  }

  async createActiveSubscription(
    userId: number,
    planId: number,
    paymentId: string,
    startDate: Date,
    endDate: Date,
    inviteLink: string,
    partnerId?: number
  ) {
    return prisma.subscription.create({
      data: {
        userId,
        planId,
        paymentId,
        status: 'ACTIVE',
        startDate,
        endDate,
        inviteLink,
        partnerId,
      },
    });
  }
}
