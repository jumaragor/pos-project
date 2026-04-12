import bcrypt from "bcryptjs";
import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_USERS = [
  {
    name: "Owner Demo",
    email: "owner@microbiz.local",
    username: "owner",
    password: "Owner123!",
    role: Role.OWNER
  },
  {
    name: "Manager Demo",
    email: "manager@microbiz.local",
    username: "manager",
    password: "Manager123!",
    role: Role.MANAGER
  },
  {
    name: "Cashier Demo",
    email: "cashier@microbiz.local",
    username: "cashier",
    password: "Cashier123!",
    role: Role.CASHIER
  }
] as const;

async function ensureDefaultUsers() {
  const preservedIds: string[] = [];

  for (const account of DEFAULT_USERS) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        username: account.username,
        passwordHash,
        role: account.role,
        status: UserStatus.ACTIVE
      },
      create: {
        name: account.name,
        email: account.email,
        username: account.username,
        passwordHash,
        role: account.role,
        status: UserStatus.ACTIVE
      }
    });
    preservedIds.push(user.id);
  }

  return preservedIds;
}

async function main() {
  const preservedUserIds = await ensureDefaultUsers();

  await prisma.syncOperation.deleteMany();

  await prisma.inventoryLayer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();

  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();

  await prisma.expense.deleteMany();

  await prisma.unitConversionRule.deleteMany();
  await prisma.product.deleteMany();

  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();

  await prisma.auditLog.deleteMany();

  await prisma.user.deleteMany({
    where: {
      id: { notIn: preservedUserIds }
    }
  });

  console.log("Demo data cleanup completed.");
  for (const account of DEFAULT_USERS) {
    console.log(`${account.role}: ${account.username} / ${account.password}`);
  }
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
