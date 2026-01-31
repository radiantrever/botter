import prisma from '../db/prisma';

export class PreviewRepository {
  async findActivePreviewByUserChannel(userId: number, channelId: number) {
    return prisma.previewAccess.findFirst({
      where: {
        userId,
        channelId,
        status: 'ACTIVE',
        endDate: { gt: new Date() },
      },
    });
  }

  async findLatestPreviewByUserChannel(userId: number, channelId: number) {
    return prisma.previewAccess.findFirst({
      where: {
        userId,
        channelId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPreviewAccess(
    userId: number,
    channelId: number,
    startDate: Date,
    endDate: Date,
    inviteLink: string
  ) {
    return prisma.previewAccess.create({
      data: {
        userId,
        channelId,
        startDate,
        endDate,
        inviteLink,
        status: 'ACTIVE',
      },
    });
  }

  async findExpiredActivePreviews() {
    return prisma.previewAccess.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: new Date() },
      },
      include: { user: true, channel: true },
    });
  }

  async updateStatus(id: number, status: string) {
    return prisma.previewAccess.update({
      where: { id },
      data: { status },
    });
  }

  async markConvertedByUserChannel(userId: number, channelId: number) {
    return prisma.previewAccess.updateMany({
      where: {
        userId,
        channelId,
        status: 'ACTIVE',
      },
      data: { status: 'CONVERTED' },
    });
  }
}
