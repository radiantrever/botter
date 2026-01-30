"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorRepository = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
class CreatorRepository {
    async createCreator(userId) {
        // First ensure user exists? Assumed handled by service.
        // Here we just map user to creator.
        // Currently Creator just links to User, but we might add fields later.
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error("User not found");
        return prisma_1.default.creator.create({
            data: {
                userId: userId,
            },
        });
    }
    async findByUserId(userId) {
        return prisma_1.default.creator.findUnique({
            where: { userId },
            include: { channels: true },
        });
    }
    async findByTelegramId(telegramId) {
        return prisma_1.default.creator.findFirst({
            where: { user: { telegramId } },
            include: { channels: true },
        });
    }
}
exports.CreatorRepository = CreatorRepository;
