import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async findByTelegramId(telegramId: bigint) {
    return prisma.user.findUnique({
      where: { telegramId },
      include: { creator: true, subscriptions: true },
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
    });
  }

  async upsertUser(
    telegramId: bigint,
    username?: string,
    firstName?: string,
    lastName?: string,
    language?: string
  ) {
    const updateData: any = { username, firstName, lastName };
    if (language) updateData.language = language;

    const existing = await prisma.user.findUnique({ where: { telegramId } });

    if (existing) {
      return prisma.user.update({
        where: { telegramId },
        data: updateData,
      });
    }

    // New User logic
    const createData: any = {
      telegramId,
      username: username ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      language: language ?? 'en',
    };

    return prisma.user.create({
      data: createData,
    });
  }
}
