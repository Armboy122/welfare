import { createClient } from "redis";

// กำหนด global type สำหรับ Redis client
declare global {
  // eslint-disable-next-line no-var
  var redis: ReturnType<typeof createClient> | undefined;
}

// สร้าง Redis client instance
const redis = global.redis || createClient({
  url: process.env.REDIS_URL,
});

// เก็บ instance ไว้ใน global scope สำหรับ development
if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}

/**
 * บันทึกข้อมูลลง Redis cache
 * @param key - คีย์สำหรับเก็บข้อมูล
 * @param value - ข้อมูลที่ต้องการเก็บ
 * @param expireInSeconds - เวลาหมดอายุ (วินาที)
 */
export async function setCache<T>(
  key: string,
  value: T,
  expireInSeconds?: number
): Promise<void> {
  const client = await getRedisClient();
  const stringValue = JSON.stringify(value);

  if (expireInSeconds) {
    await client.setEx(key, expireInSeconds, stringValue);
  } else {
    await client.set(key, stringValue);
  }
}

/**
 * ดึงข้อมูลจาก Redis cache
 * @param key - คีย์ที่ต้องการดึงข้อมูล
 * @returns ข้อมูลที่ต้องการหรือ null ถ้าไม่พบ
 */
export async function getCache<T>(
  key: string
): Promise<T | null> {
  const client = await getRedisClient();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

/**
 * เชื่อมต่อและรับ Redis client
 * @returns Redis client ที่พร้อมใช้งาน
 */
export async function getRedisClient() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

export default redis;