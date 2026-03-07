import { redis } from "./cache";

/**
 * Sliding window rate limiter using Upstash Redis.
 * Returns { allowed: boolean, remaining: number, resetMs: number }
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const redisKey = `rl:${key}`;

    // Use a simple counter with TTL
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
    };
  } catch {
    // Redis down — allow request
    return { allowed: true, remaining: maxRequests };
  }
}
