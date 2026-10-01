import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// In-memory fallback for local dev
const inMemoryStore = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MIN = 20;

let redisClient: Redis | null = null;
let upstashRatelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    upstashRatelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_MIN, '60 s'),
      analytics: true,
      prefix: 'receiptlens_ratelimit',
    });
  } catch (err) {
    console.error('Failed to initialize Upstash Redis ratelimiter:', err);
  }
} else {
  console.warn(
    '[RateLimit] Upstash Redis credentials not set. Falling back to in-memory rate limiting (local development only).'
  );
}

export function getClientIp(headers: Record<string, string | string[] | undefined>, fallbackIp = '127.0.0.1'): string {
  const getHeader = (key: string): string | undefined => {
    const val = headers[key] || headers[key.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const realIp = getHeader('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  const vercelForwardedFor = getHeader('x-vercel-forwarded-for');
  if (vercelForwardedFor && vercelForwardedFor.trim()) {
    return vercelForwardedFor.split(',')[0].trim();
  }

  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return fallbackIp;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  remaining?: number;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  // 1. Check Global Daily Request Cap if configured
  const dailyCapStr = process.env.DAILY_REQUEST_CAP;
  if (dailyCapStr && redisClient) {
    const dailyCap = parseInt(dailyCapStr, 10);
    if (!isNaN(dailyCap) && dailyCap > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const dailyKey = `receiptlens:daily_cap:${today}`;
      const currentCount = await redisClient.incr(dailyKey);
      if (currentCount === 1) {
        // Expire key after 25 hours
        await redisClient.expire(dailyKey, 25 * 3600);
      }
      if (currentCount > dailyCap) {
        return {
          allowed: false,
          reason: 'Global daily request limit reached. Please try again tomorrow.',
        };
      }
    }
  }

  // 2. Check Per-IP Rate Limit (Upstash or In-Memory)
  if (upstashRatelimit) {
    try {
      const res = await upstashRatelimit.limit(ip);
      if (!res.success) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded. Maximum 20 requests per minute allowed.',
          limit: res.limit,
          remaining: res.remaining,
        };
      }
      return { allowed: true, limit: res.limit, remaining: res.remaining };
    } catch (redisErr) {
      console.warn('Upstash rate limit check failed, falling back to memory check:', redisErr);
    }
  }

  // Fallback in-memory sliding window
  const now = Date.now();
  const timestamps = (inMemoryStore.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_MIN) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded (in-memory). Maximum 20 requests per minute allowed.',
    };
  }
  timestamps.push(now);
  inMemoryStore.set(ip, timestamps);
  return { allowed: true };
}
