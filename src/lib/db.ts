import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/** Bump when schema/connection changes so HMR does not reuse a stale client. */
const CLIENT_VERSION = 18;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaVersion?: number;
};

function createPrismaClient() {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER || "beeflow",
    password: process.env.DATABASE_PASSWORD || "beeflow",
    database: process.env.DATABASE_NAME || "beeflow",
    connectionLimit: 5,
    connectTimeout: 8_000,
    acquireTimeout: 10_000,
    allowPublicKeyRetrieval: true,
  });

  return new PrismaClient({ adapter });
}

function ensureClient() {
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaVersion !== CLIENT_VERSION
  ) {
    const previous = globalForPrisma.prisma;
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaVersion = CLIENT_VERSION;
    if (previous) {
      void previous.$disconnect().catch(() => undefined);
    }
  }
  return globalForPrisma.prisma;
}

export const prisma = ensureClient();

export async function resetPrismaClient() {
  try {
    await globalForPrisma.prisma?.$disconnect();
  } catch {
    // ignore
  }
  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.prismaVersion = CLIENT_VERSION;
  return globalForPrisma.prisma;
}
