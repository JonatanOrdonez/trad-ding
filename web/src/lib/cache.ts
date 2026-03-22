import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getRedis(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
    client = new Redis({ url, token });
  }
  return client;
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await getRedis().get<T>(key);
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, data, { ex: ttlSeconds });
  } catch {
    // cache write failures are non-fatal
  }
}
