import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { ensureDefaultExpenseCategories } from "../src/lib/expense-utils";

const prisma = new PrismaClient();

async function main() {
  const ownerPassword = await bcrypt.hash("Owner123!", 10);
  const managerPassword = await bcrypt.hash("Manager123!", 10);
  const cashierPassword = await bcrypt.hash("Cashier123!", 10);

  await prisma.user.upsert({
    where: { email: "owner@microbiz.local" },
    update: {
      name: "Owner Demo",
      username: "owner",
      passwordHash: ownerPassword,
      role: Role.OWNER
    },
    create: {
      name: "Owner Demo",
      username: "owner",
      email: "owner@microbiz.local",
      passwordHash: ownerPassword,
      role: Role.OWNER
    }
  });

  await prisma.user.upsert({
    where: { email: "manager@microbiz.local" },
    update: {
      name: "Manager Demo",
      username: "manager",
      passwordHash: managerPassword,
      role: Role.MANAGER
    },
    create: {
      name: "Manager Demo",
      username: "manager",
      email: "manager@microbiz.local",
      passwordHash: managerPassword,
      role: Role.MANAGER
    }
  });

  await prisma.user.upsert({
    where: { email: "cashier@microbiz.local" },
    update: {
      name: "Cashier Demo",
      username: "cashier",
      passwordHash: cashierPassword,
      role: Role.CASHIER
    },
    create: {
      name: "Cashier Demo",
      username: "cashier",
      email: "cashier@microbiz.local",
      passwordHash: cashierPassword,
      role: Role.CASHIER
    }
  });

  await prisma.unitConversionRule.createMany({
    data: [
      {
        fromUnit: "box",
        toUnit: "pc",
        factor: "12"
      }
    ],
    skipDuplicates: true
  });

  await prisma.appSetting.upsert({
    where: { key: "allowNegativeStock" },
    update: {},
    create: { key: "allowNegativeStock", value: "false" }
  });

  await ensureDefaultExpenseCategories(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
