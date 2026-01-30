import { Redis } from 'ioredis';

// Initialize Redis client for caching
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

// In-memory cache as fallback
interface CacheEntry {
  value: any;
  expiry: number;
}

const inMemoryCache = new Map<string, CacheEntry>();

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress the value
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a value from cache
 * @param key Cache key
 * @returns Cached value or null if not found/expired
 */
export async function getFromCache<T = any>(key: string): Promise<T | null> {
  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      console.warn('Redis cache get error:', error);
      // Fall through to in-memory cache
    }
  }

  // Fallback to in-memory cache
  const entry = inMemoryCache.get(key);
  if (entry) {
    const now = Date.now();
    if (entry.expiry > now) {
      return entry.value as T;
    } else {
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
export async function setInCache<T = any>(key: string, value: T, options?: CacheOptions): Promise<void> {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const expiry = Date.now() + (ttl * 1000);
  
  // Set in Redis if available
  if (redis) {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
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
export async function removeFromCache(key: string): Promise<void> {
  // Delete from Redis if available
  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      console.warn('Redis cache delete error:', error);
    }
  }

  // Delete from memory cache
  inMemoryCache.delete(key);
}

/**
 * Clear all cache entries
 */
export async function clearCache(): Promise<void> {
  // Clear Redis if available
  if (redis) {
    try {
      await redis.flushdb();
    } catch (error) {
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
export function Cache(ttl: number = DEFAULT_TTL) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
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
export const getChannelCache = async (channelId: number | string) => {
  return getFromCache<Channel>(`channel:${channelId}`);
};

export const setChannelCache = async (channelId: number | string, channel: Channel, ttl: number = 300) => {
  return setInCache<Channel>(`channel:${channelId}`, channel, { ttl });
};

export const getUserCache = async (userId: number | string) => {
  return getFromCache<User>(`user:${userId}`);
};

export const setUserCache = async (userId: number | string, user: User, ttl: number = 600) => {
  return setInCache<User>(`user:${userId}`, user, { ttl });
};

export const getSubscriptionPlansCache = async (channelId: number | string) => {
  return getFromCache<SubscriptionPlan[]>(`plans:${channelId}`);
};

export const setSubscriptionPlansCache = async (channelId: number | string, plans: SubscriptionPlan[], ttl: number = 1800) => {
  return setInCache<SubscriptionPlan[]>(`plans:${channelId}`, plans, { ttl });
};

// Type definitions for cache
interface Channel {
  id: number;
  telegramChannelId: bigint;
  title: string;
  creatorId: number;
  commissionRate: number;
  plans: SubscriptionPlan[];
}

interface User {
  id: number;
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  createdAt: Date;
}

interface SubscriptionPlan {
  id: number;
  channelId: number;
  name: string;
  price: number;
  durationDay: number;
  isActive: boolean;
}