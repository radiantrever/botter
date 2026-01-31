import prisma from '../db/prisma';

export interface PartnerSummary {
  approvedPartners: Array<{
    id: number;
    channelId: number;
    channelTitle: string;
    commissionRate: number;
  }>;
  pendingCount: number;
  totalEarnings: number;
  totalConversions: number;
  activeReferrals: number;
  newToday: number;
  availableBalance: number;
}

export interface PartnerChannelStats {
  channelId: number;
  title: string;
  conversions: number;
  earnings: number;
  active: number;
}

export interface PartnerAnalytics extends PartnerSummary {
  channels: PartnerChannelStats[];
}

export class PartnerService {
  async getPartnerSummary(telegramId: bigint): Promise<PartnerSummary> {
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      return {
        approvedPartners: [],
        pendingCount: 0,
        totalEarnings: 0,
        totalConversions: 0,
        activeReferrals: 0,
        newToday: 0,
        availableBalance: 0,
      };
    }

    const [approvedPartners, pendingCount] = await Promise.all([
      prisma.partner.findMany({
        where: { userId: user.id, status: 'APPROVED' },
        include: { channel: true },
      }),
      prisma.partner.count({
        where: { userId: user.id, status: 'PENDING' },
      }),
    ]);

    const partnerIds = approvedPartners.map(partner => partner.id);

    let totalEarnings = 0;
    let totalConversions = 0;
    let activeReferrals = 0;
    let newToday = 0;

    if (partnerIds.length > 0) {
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const [transactionStats, activeCount, newTodayCount] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            partnerId: { in: partnerIds },
            status: 'COMPLETED',
          },
          _sum: { partnerShare: true },
          _count: { _all: true },
        }),
        prisma.subscription.count({
          where: {
            partnerId: { in: partnerIds },
            status: 'ACTIVE',
            endDate: { gt: now },
          },
        }),
        prisma.subscription.count({
          where: {
            partnerId: { in: partnerIds },
            createdAt: { gte: startOfToday },
          },
        }),
      ]);

      totalEarnings = transactionStats._sum.partnerShare || 0;
      totalConversions = transactionStats._count._all || 0;
      activeReferrals = activeCount;
      newToday = newTodayCount;
    }

    const creator = await prisma.creator.findUnique({
      where: { userId: user.id },
    });

    let availableBalance = 0;
    if (creator) {
      const balance = await prisma.creatorBalance.findUnique({
        where: { creatorId: creator.id },
      });
      availableBalance = balance?.availableBalance || 0;
    }

    return {
      approvedPartners: approvedPartners.map(partner => ({
        id: partner.id,
        channelId: partner.channelId,
        channelTitle: partner.channel.title,
        commissionRate: partner.commissionRate,
      })),
      pendingCount,
      totalEarnings,
      totalConversions,
      activeReferrals,
      newToday,
      availableBalance,
    };
  }

  async getPartnerAnalytics(telegramId: bigint): Promise<PartnerAnalytics> {
    const summary = await this.getPartnerSummary(telegramId);

    if (summary.approvedPartners.length === 0) {
      return { ...summary, channels: [] };
    }

    const partnerIds = summary.approvedPartners.map(partner => partner.id);
    const now = new Date();

    const [transactionGroups, activeGroups] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['partnerId'],
        where: {
          partnerId: { in: partnerIds },
          status: 'COMPLETED',
        },
        _sum: { partnerShare: true },
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ['partnerId'],
        where: {
          partnerId: { in: partnerIds },
          status: 'ACTIVE',
          endDate: { gt: now },
        },
        _count: { _all: true },
      }),
    ]);

    const transactionMap = new Map<
      number,
      { conversions: number; earnings: number }
    >();
    for (const group of transactionGroups) {
      if (group.partnerId === null) continue;
      transactionMap.set(group.partnerId, {
        conversions: group._count._all || 0,
        earnings: group._sum.partnerShare || 0,
      });
    }

    const activeMap = new Map<number, number>();
    for (const group of activeGroups) {
      if (group.partnerId === null) continue;
      activeMap.set(group.partnerId, group._count._all || 0);
    }

    const channels: PartnerChannelStats[] = summary.approvedPartners.map(
      partner => {
        const txStats = transactionMap.get(partner.id);
        return {
          channelId: partner.channelId,
          title: partner.channelTitle,
          conversions: txStats?.conversions || 0,
          earnings: txStats?.earnings || 0,
          active: activeMap.get(partner.id) || 0,
        };
      }
    );

    channels.sort((a, b) => b.earnings - a.earnings);

    return { ...summary, channels };
  }

  async getPartnerLinks(telegramId: bigint) {
    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) return [];

    const approvedPartners = await prisma.partner.findMany({
      where: { userId: user.id, status: 'APPROVED' },
      include: { channel: true },
    });

    return approvedPartners.map(partner => ({
      partnerId: partner.id,
      channelId: partner.channelId,
      channelTitle: partner.channel.title,
    }));
  }
}
