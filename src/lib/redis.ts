import { createClient } from "redis";

const redis = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6380' 
});

redis.on("error", (err) => console.error("Redis Error:", err));

// เพิ่ม connect function
await redis.connect().catch(console.error);

export async function getCache(key: string) {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setCache(key: string, value: unknown, ttl = 3600) {
  await redis.set(key, JSON.stringify(value), { EX: ttl });
}

export async function clearCache(key: string) {
  await redis.del(key);
}

export default redis; 