"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelRepository = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
class ChannelRepository {
    async createChannel(creatorId, telegramChannelId, title) {
        return prisma_1.default.channel.create({
            data: {
                creatorId,
                telegramChannelId,
                title,
            },
        });
    }
    async findByTelegramId(telegramChannelId) {
        return prisma_1.default.channel.findUnique({
            where: { telegramChannelId },
            include: { plans: true },
        });
    }
    async findById(id) {
        return prisma_1.default.channel.findUnique({
            where: { id },
            include: { plans: true },
        });
    }
    async createPlan(channelId, name, price, durationDay) {
        return prisma_1.default.subscriptionPlan.create({
            data: {
                channelId,
                name,
                price,
                durationDay,
            },
        });
    }
}
exports.ChannelRepository = ChannelRepository;
