/**
 * ไฟล์นี้ใช้สำหรับตั้งค่าการเชื่อมต่อกับฐานข้อมูลผ่าน Prisma
 * มีการจัดการ connection, logging, error handling และ transaction
 */

import { PrismaClient, Prisma } from '@prisma/client';

/**
 * สร้าง type สำหรับเก็บ Prisma instance ไว้ใน global scope
 * ป้องกันการสร้าง connection ใหม่ทุกครั้งที่ import ไฟล์นี้
 * ทำให้ไม่เปลือง memory และไม่เกิด connection leak
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * กำหนดค่า configuration สำหรับ Prisma Client
 * log: บันทึกทุกการทำงานที่สำคัญ
 * - query: SQL queries ทั้งหมด
 * - info: ข้อมูลทั่วไป
 * - warn: คำเตือนต่างๆ
 * - error: ข้อผิดพลาดทั้งหมด
 * errorFormat: แสดง error ในรูปแบบที่อ่านง่าย
 */
const prismaConfig = {
  log: ['query', 'info', 'warn', 'error'] as Prisma.LogLevel[],
  errorFormat: 'pretty' as const,
};

/**
 * สร้างและ export Prisma instance
 * ถ้ามี instance อยู่แล้วใน global จะใช้อันเดิม
 * ถ้าไม่มีจะสร้างใหม่พร้อม config ที่กำหนด
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaConfig);

/**
 * Middleware สำหรับวัดเวลาการทำงานของ query
 * ใช้ตรวจสอบ performance และหา query ที่ทำงานช้า
 * params.model: ชื่อ model ที่กำลังใช้งาน (เช่น User, Post)
 * params.action: operation ที่กำลังทำ (เช่น findMany, create)
 */
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const end = Date.now();
  console.log(`Query ${params.model}.${params.action} took ${end - start}ms`);
  return result;
});

/**
 * จัดการการเชื่อมต่อตาม environment
 * Production: สร้าง connection pool ทันทีเมื่อเริ่มแอพ
 * Development: เก็บ instance ไว้ใน global scope
 */
if (process.env.NODE_ENV === 'production') {
  prisma.$connect()
    .then(() => console.log('Successfully connected to database'))
    .catch((e) => console.error('Failed to connect to database:', e));
} else {
  globalForPrisma.prisma = prisma;
}

/**
 * ฟังก์ชันสำหรับจัดการการปิดการเชื่อมต่อ
 * ทำงานเมื่อแอพปิดตัวลงไม่ว่าด้วยเหตุผลใด
 * ป้องกัน connection leak และจัดการทรัพยากรอย่างถูกต้อง
 */
const cleanup = async () => {
  try {
    await prisma.$disconnect();
    console.log('Successfully disconnected from database');
  } catch (e) {
    console.error('Error disconnecting from database:', e);
    process.exit(1);
  }
};

/**
 * เรียกใช้ cleanup เมื่อแอพปิดตัวลงด้วยเหตุผลต่างๆ
 */
process.on('beforeExit', cleanup);  // ปิดปกติ
process.on('SIGINT', cleanup);      // กด Ctrl+C
process.on('SIGTERM', cleanup);     // ถูก kill process

/**
 * Helper function สำหรับทำ transaction
 * ใช้เมื่อต้องการทำหลาย operation พร้อมกัน
 * ถ้าเกิดข้อผิดพลาด ทุก operation จะถูก rollback
 * 
 * วิธีใช้:
 * await withTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: {...} });
 *   const profile = await tx.profile.create({ data: {...} });
 *   return { user, profile };
 * });
 */
export async function withTransaction<T>(
  fn: (prisma: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(fn);
} 