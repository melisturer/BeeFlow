import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER ?? "beeflow",
  password: process.env.DATABASE_PASSWORD ?? "beeflow",
  database: process.env.DATABASE_NAME ?? "beeflow",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@beeflow.local" },
    update: {},
    create: {
      name: "Admin Kullanıcı",
      email: "admin@beeflow.local",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "calisan@beeflow.local" },
    update: { name: "Çalışan" },
    create: {
      name: "Çalışan",
      email: "calisan@beeflow.local",
      passwordHash,
      role: Role.EMPLOYEE,
    },
  });

  console.log("Seed tamamlandı:");
  console.log(`  Admin: ${admin.email} / password123`);
  console.log(`  Çalışan: ${employee.email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
