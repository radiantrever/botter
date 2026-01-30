"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
class UserRepository {
    async findByTelegramId(telegramId) {
        return prisma_1.default.user.findUnique({
            where: { telegramId },
            include: { creator: true, subscriptions: true },
        });
    }
    async createUser(data) {
        return prisma_1.default.user.create({
            data,
        });
    }
    async upsertUser(telegramId, username, firstName, lastName, language) {
        const updateData = { username, firstName, lastName };
        if (language)
            updateData.language = language;
        const existing = await prisma_1.default.user.findUnique({ where: { telegramId } });
        if (existing) {
            return prisma_1.default.user.update({
                where: { telegramId },
                data: updateData
            });
        }
        // New User logic
        const createData = {
            telegramId,
            username: username ?? null,
            firstName: firstName ?? null,
            lastName: lastName ?? null,
            language: language ?? 'en'
        };
        return prisma_1.default.user.create({
            data: createData
        });
    }
}
exports.UserRepository = UserRepository;
