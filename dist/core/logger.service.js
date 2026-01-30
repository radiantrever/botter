"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_FILE = path_1.default.join(process.cwd(), 'payout_requests.log');
class LoggerService {
    /**
     * Logs payout request to file and sends notification to admin channel.
     */
    static async logPayoutRequest(details) {
        const timestamp = new Date().toISOString();
        const fullName = `${details.firstName ?? ''} ${details.lastName ?? ''}`.trim();
        const userDisplay = details.username ? `@${details.username}` : (fullName || 'Unknown');
        // 1. Internal Log Entry
        const logEntry = `[${timestamp}] PAYOUT_ID: ${details.payoutId} | TG_ID: ${details.telegramId} | USER: ${userDisplay} | AMOUNT: ${details.amount} UZS | CARD: ${details.cardNumber} | BALANCE_LEFT: ${details.totalBalance} | TOTAL_ALREADY_ASKED: ${details.totalWithdrawn}\n`;
        try {
            fs_1.default.appendFileSync(LOG_FILE, logEntry);
        }
        catch (err) {
            console.error("Critical Error: Failed to write to payout log file!", err);
        }
        // 2. Telegram Notification
        const channelId = process.env.LOG_CHANNEL_ID;
        if (!channelId) {
            console.warn("LOG_CHANNEL_ID not set in .env. Skipping Telegram notification.");
            return;
        }
        const message = `💸 **NEW PAYOUT REQUEST** 💸\n\n` +
            `🆔 **ID:** \`${details.payoutId}\`\n` +
            `👤 **Creator:** ${fullName || 'N/A'} (${details.username ? '@' + details.username : 'No username'})\n` +
            `🆔 **Telegram ID:** \`${details.telegramId}\`\n` +
            `💰 **Amount Now:** \`${details.amount.toLocaleString()} UZS\`\n` +
            `💳 **Card Number:** \`${details.cardNumber}\`\n\n` +
            `📊 **Financial Overview:**\n` +
            `➡ **Remaining Balance:** \`${details.totalBalance.toLocaleString()} UZS\`\n` +
            `⬅ **Total Already Requested:** \`${details.totalWithdrawn.toLocaleString()} UZS\`\n\n` +
            `📅 **Timestamp:** \`${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}\``;
        try {
            const { bot } = require('../bot/bot');
            await bot.api.sendMessage(channelId, message, { parse_mode: 'Markdown' });
        }
        catch (err) {
            console.error("Failed to send payout notification to Telegram channel:", err);
        }
    }
    static async logEvent(message) {
        const channelId = process.env.LOG_CHANNEL_ID;
        if (!channelId)
            return;
        try {
            const { bot } = require('../bot/bot');
            await bot.api.sendMessage(channelId, message, { parse_mode: 'Markdown' });
        }
        catch (err) {
            console.error("Failed to send event notification to Telegram channel:", err);
        }
    }
}
exports.LoggerService = LoggerService;
