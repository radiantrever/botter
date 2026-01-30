import prisma from '../db/prisma';

export class CreatorRepository {
  async createCreator(userId: number) {
    // First ensure user exists? Assumed handled by service.
    // Here we just map user to creator.
    // Currently Creator just links to User, but we might add fields later.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    return prisma.creator.create({
      data: {
        userId: userId,
      },
    });
  }

  async findByUserId(userId: number) {
    return prisma.creator.findUnique({
      where: { userId },
      include: { channels: true },
    });
  }

  async findByTelegramId(telegramId: bigint) {
    return prisma.creator.findFirst({
      where: { user: { telegramId } },
      include: { channels: true },
    });
  }
}
