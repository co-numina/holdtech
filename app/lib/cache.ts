import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "https://sweeping-llama-44628.upstash.io",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "Aa5UAAIncDI1MGYxNTYzY2RjMTQ0M2Y5YjMzMmMzMDg3YWM3ZDAzMnAyNDQ2Mjg",
});

/**
 * Cache-through helper. Returns cached value if exists, otherwise calls fn() and caches result.
 * @param key - Redis key
 * @param ttlSeconds - TTL in seconds
 * @param fn - async function to call on cache miss
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis down — fall through to fn()
  }

  const result = await fn();

  try {
    await redis.set(key, JSON.stringify(result), { ex: ttlSeconds });
  } catch {
    // Redis down — still return result
  }

  return result;
}

/**
 * Direct cache set
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch {}
}

/**
 * Direct cache get
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export { redis };
