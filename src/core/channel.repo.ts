import prisma from '../db/prisma';

export class ChannelRepository {
    async createChannel(creatorId: number, telegramChannelId: bigint, title: string) {
        return prisma.channel.create({
            data: {
                creatorId,
                telegramChannelId,
                title,
            },
        });
    }

    async findByTelegramId(telegramChannelId: bigint) {
        return prisma.channel.findUnique({
            where: { telegramChannelId },
            include: { plans: true },
        });
    }

    async findById(id: number) {
        return prisma.channel.findUnique({
            where: { id },
            include: { plans: true },
        });
    }

    async createPlan(channelId: number, name: string, price: number, durationDay: number) {
        return prisma.subscriptionPlan.create({
            data: {
                channelId,
                name,
                price,
                durationDay,
            },
        });
    }
}
