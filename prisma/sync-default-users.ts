import bcrypt from "bcryptjs";
import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_USERS = [
  {
    name: "Owner Demo",
    username: "owner",
    email: "owner@microbiz.local",
    password: "Owner123!",
    role: Role.OWNER
  },
  {
    name: "Manager Demo",
    username: "manager",
    email: "manager@microbiz.local",
    password: "Manager123!",
    role: Role.MANAGER
  },
  {
    name: "Cashier Demo",
    username: "cashier",
    email: "cashier@microbiz.local",
    password: "Cashier123!",
    role: Role.CASHIER
  }
] as const;

async function main() {
  for (const account of DEFAULT_USERS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        username: account.username,
        passwordHash: await bcrypt.hash(account.password, 10),
        role: account.role,
        status: UserStatus.ACTIVE
      },
      create: {
        name: account.name,
        username: account.username,
        email: account.email,
        passwordHash: await bcrypt.hash(account.password, 10),
        role: account.role,
        status: UserStatus.ACTIVE
      }
    });
  }

  console.log("Default users synced.");
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
