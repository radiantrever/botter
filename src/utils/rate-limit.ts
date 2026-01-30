// Simple in-memory rate limiter for the application
// This is suitable for single-instance deployments

interface LimiterRecord {
  count: number;
  resetTime: number;
}

const inMemoryLimits = new Map<string, LimiterRecord>();

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 10000; // 10 seconds

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

export async function rateLimit(identifier: string, limit: number = DEFAULT_LIMIT, windowMs: number = DEFAULT_WINDOW_MS): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / windowMs)}`;
  
  const record = inMemoryLimits.get(key) || { count: 0, resetTime: now + windowMs };
  
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
export const telegramRateLimit = async (userId: number | bigint): Promise<RateLimitResult> => {
  return rateLimit(`tg:${userId}`, 20, 60000); // 20 requests per minute per user
};

export const channelRateLimit = async (channelId: number | bigint): Promise<RateLimitResult> => {
  return rateLimit(`channel:${channelId}`, 100, 60000); // 100 requests per minute per channel
};

export const paymentRateLimit = async (userId: number | bigint): Promise<RateLimitResult> => {
  return rateLimit(`payment:${userId}`, 5, 300000); // 5 payment attempts per 5 minutes per user
};

export const webhookRateLimit = async (sourceIp: string): Promise<RateLimitResult> => {
  return rateLimit(`webhook:${sourceIp}`, 50, 10000); // 50 requests per 10 seconds per IP
};

// Redis-based rate limiter for multi-instance deployments
// This is a placeholder that will be implemented when Redis is available
export const redisRateLimit = async (identifier: string, limit: number = DEFAULT_LIMIT, windowMs: number = DEFAULT_WINDOW_MS): Promise<RateLimitResult> => {
  // In a real implementation, this would use Redis for shared state
  // For now, fall back to in-memory limiter
  return rateLimit(identifier, limit, windowMs);
};