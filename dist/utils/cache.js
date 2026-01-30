"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSubscriptionPlansCache = exports.getSubscriptionPlansCache = exports.setUserCache = exports.getUserCache = exports.setChannelCache = exports.getChannelCache = void 0;
exports.getFromCache = getFromCache;
exports.setInCache = setInCache;
exports.removeFromCache = removeFromCache;
exports.clearCache = clearCache;
exports.Cache = Cache;
const ioredis_1 = require("ioredis");
// Initialize Redis client for caching
let redis = null;
if (process.env.REDIS_URL) {
    redis = new ioredis_1.Redis(process.env.REDIS_URL);
}
const inMemoryCache = new Map();
const DEFAULT_TTL = 300; // 5 minutes
/**
 * Get a value from cache
 * @param key Cache key
 * @returns Cached value or null if not found/expired
 */
async function getFromCache(key) {
    // Try Redis first
    if (redis) {
        try {
            const cached = await redis.get(key);
            if (cached !== null) {
                return JSON.parse(cached);
            }
        }
        catch (error) {
            console.warn('Redis cache get error:', error);
            // Fall through to in-memory cache
        }
    }
    // Fallback to in-memory cache
    const entry = inMemoryCache.get(key);
    if (entry) {
        const now = Date.now();
        if (entry.expiry > now) {
            return entry.value;
        }
        else {
            // Entry expired, remove it
            inMemoryCache.delete(key);
        }
    }
    return null;
}
/**
 * Set a value in cache
 * @param key Cache key
 * @param value Value to cache
 * @param options Cache options
 */
async function setInCache(key, value, options) {
    const ttl = options?.ttl ?? DEFAULT_TTL;
    const expiry = Date.now() + ttl * 1000;
    // Set in Redis if available
    if (redis) {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
        }
        catch (error) {
            console.warn('Redis cache set error:', error);
            // Still set in memory cache as fallback
        }
    }
    // Always set in memory cache as fallback
    inMemoryCache.set(key, { value, expiry });
}
/**
 * Delete a value from cache
 * @param key Cache key to delete
 */
async function removeFromCache(key) {
    // Delete from Redis if available
    if (redis) {
        try {
            await redis.del(key);
        }
        catch (error) {
            console.warn('Redis cache delete error:', error);
        }
    }
    // Delete from memory cache
    inMemoryCache.delete(key);
}
/**
 * Clear all cache entries
 */
async function clearCache() {
    // Clear Redis if available
    if (redis) {
        try {
            await redis.flushdb();
        }
        catch (error) {
            console.warn('Redis cache clear error:', error);
        }
    }
    // Clear memory cache
    inMemoryCache.clear();
}
/**
 * Cache decorator for class methods
 * @param ttl Time to live in seconds
 */
function Cache(ttl = DEFAULT_TTL) {
    return function (target, propertyKey, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            // Create cache key from method name and arguments
            const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
            // Try to get from cache first
            const cachedResult = await getFromCache(cacheKey);
            if (cachedResult !== null) {
                return cachedResult;
            }
            // Execute the original method
            const result = await method.apply(this, args);
            // Store in cache
            await setInCache(cacheKey, result, { ttl });
            return result;
        };
    };
}
// Specific cache utilities for common use cases
const getChannelCache = async (channelId) => {
    return getFromCache(`channel:${channelId}`);
};
exports.getChannelCache = getChannelCache;
const setChannelCache = async (channelId, channel, ttl = 300) => {
    return setInCache(`channel:${channelId}`, channel, { ttl });
};
exports.setChannelCache = setChannelCache;
const getUserCache = async (userId) => {
    return getFromCache(`user:${userId}`);
};
exports.getUserCache = getUserCache;
const setUserCache = async (userId, user, ttl = 600) => {
    return setInCache(`user:${userId}`, user, { ttl });
};
exports.setUserCache = setUserCache;
const getSubscriptionPlansCache = async (channelId) => {
    return getFromCache(`plans:${channelId}`);
};
exports.getSubscriptionPlansCache = getSubscriptionPlansCache;
const setSubscriptionPlansCache = async (channelId, plans, ttl = 1800) => {
    return setInCache(`plans:${channelId}`, plans, { ttl });
};
exports.setSubscriptionPlansCache = setSubscriptionPlansCache;
