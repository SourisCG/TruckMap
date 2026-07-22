import { Redis } from "@upstash/redis";

type MemoryRecord = { count: number; resetsAt: number };

const memoryLimits = new Map<string, MemoryRecord>();

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const redis = getRedis();
  const window = Math.floor(Date.now() / (windowSeconds * 1_000));
  const storageKey = `ratelimit:${key}:${window}`;

  if (redis) {
    const count = await redis.incr(storageKey);
    if (count === 1) await redis.expire(storageKey, windowSeconds + 5);
    return count <= limit;
  }

  const now = Date.now();
  const current = memoryLimits.get(storageKey);
  if (!current || current.resetsAt <= now) {
    memoryLimits.set(storageKey, { count: 1, resetsAt: now + windowSeconds * 1_000 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function requestIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
