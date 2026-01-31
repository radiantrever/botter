import prisma from '../db/prisma';

export const FEES = {
  PROVIDER_PERCENT: 0.05, // 5% Tip: TsPay
  PLATFORM_PERCENT: 0.05, // 5% Tip: Our share
};

export class LedgerService {
  // Calculate shares based on gross amount
  // Partner commission is calculated from remaining amount after fees
  calculateFees(
    grossAmount: number,
    platformPercent: number,
    partnerPercent: number = 0
  ) {
    const providerFee = Math.floor(grossAmount * FEES.PROVIDER_PERCENT);
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

  async recordTransaction(
    subscriptionId: number,
    grossAmount: number,
    creatorId: number
  ) {
    // Fetch subscription and linked partner
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        partner: true,
        plan: { include: { channel: true } },
      },
    });

    const channel = subscription?.plan?.channel;
    const platformPercent = channel?.commissionRate ?? FEES.PLATFORM_PERCENT;

    // Only apply partner commission if the partner is APPROVED
    const partner =
      subscription?.partner?.status === 'APPROVED'
        ? subscription.partner
        : null;
    const partnerPercent = partner?.commissionRate ?? 0;

    const { providerFee, platformFee, partnerShare, creatorShare } =
      this.calculateFees(grossAmount, platformPercent, partnerPercent);

    return prisma.$transaction(async (tx: any) => {
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

  async recordBundleTransaction(
    bundleSubscriptionId: number,
    grossAmount: number,
    creatorId: number,
    platformPercent: number = FEES.PLATFORM_PERCENT
  ) {
    const { providerFee, platformFee, creatorShare } = this.calculateFees(
      grossAmount,
      platformPercent,
      0
    );

    return prisma.$transaction(async (tx: any) => {
      const transaction = await tx.bundleTransaction.create({
        data: {
          bundleSubId: bundleSubscriptionId,
          grossAmount,
          providerFee,
          platformFee,
          creatorShare,
          status: 'COMPLETED',
        },
      });

      await tx.creatorBalance.upsert({
        where: { creatorId },
        update: { availableBalance: { increment: creatorShare } },
        create: { creatorId, availableBalance: creatorShare },
      });

      return transaction;
    });
  }

  async getBalance(creatorId: number) {
    const balance = await prisma.creatorBalance.findUnique({
      where: { creatorId },
    });
    return balance?.availableBalance || 0;
  }
}
