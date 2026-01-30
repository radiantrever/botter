"use strict";
// Simple in-memory rate limiter for the application
// This is suitable for single-instance deployments
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisRateLimit = exports.webhookRateLimit = exports.paymentRateLimit = exports.channelRateLimit = exports.telegramRateLimit = void 0;
exports.rateLimit = rateLimit;
const inMemoryLimits = new Map();
const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 10000; // 10 seconds
async function rateLimit(identifier, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / windowMs)}`;
    const record = inMemoryLimits.get(key) || {
        count: 0,
        resetTime: now + windowMs,
    };
    if (record.resetTime < now) {
        record.count = 0;
        record.resetTime = now + windowMs;
    }
    record.count++;
    inMemoryLimits.set(key, record);
    const success = record.count <= limit;
    const remaining = Math.max(0, limit - record.count);
    return {
        success,
        remaining,
        reset: record.resetTime,
        limit,
    };
}
// Specific rate limiters for different use cases
const telegramRateLimit = async (userId) => {
    return rateLimit(`tg:${userId}`, 20, 60000); // 20 requests per minute per user
};
exports.telegramRateLimit = telegramRateLimit;
const channelRateLimit = async (channelId) => {
    return rateLimit(`channel:${channelId}`, 100, 60000); // 100 requests per minute per channel
};
exports.channelRateLimit = channelRateLimit;
const paymentRateLimit = async (userId) => {
    return rateLimit(`payment:${userId}`, 5, 300000); // 5 payment attempts per 5 minutes per user
};
exports.paymentRateLimit = paymentRateLimit;
const webhookRateLimit = async (sourceIp) => {
    return rateLimit(`webhook:${sourceIp}`, 50, 10000); // 50 requests per 10 seconds per IP
};
exports.webhookRateLimit = webhookRateLimit;
// Redis-based rate limiter for multi-instance deployments
// This is a placeholder that will be implemented when Redis is available
const redisRateLimit = async (identifier, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) => {
    // In a real implementation, this would use Redis for shared state
    // For now, fall back to in-memory limiter
    return rateLimit(identifier, limit, windowMs);
};
exports.redisRateLimit = redisRateLimit;
