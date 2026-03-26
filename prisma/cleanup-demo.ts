import bcrypt from "bcryptjs";
import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();
const resetPassword = "MicroBiz123!";
const resetEmail = "owner@microbiz.local";
const resetUsername = "owner";
const resetName = "Owner Demo";

async function ensureOwnerAccount() {
  const owner = await prisma.user.findFirst({
    where: { role: Role.OWNER },
    orderBy: { createdAt: "asc" }
  });

  if (owner) {
    return owner;
  }

  const passwordHash = await bcrypt.hash(resetPassword, 10);
  return prisma.user.create({
    data: {
      name: resetName,
      email: resetEmail,
      username: resetUsername,
      passwordHash,
      role: Role.OWNER
    }
  });
}

async function main() {
  const owner = await ensureOwnerAccount();

  await prisma.syncOperation.deleteMany();

  await prisma.stockMovement.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();

  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();

  await prisma.unitConversionRule.deleteMany();
  await prisma.product.deleteMany();

  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();

  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ entityType: "Transaction" }, { entityType: "Purchase" }, { entityType: "Product" }]
    }
  });

  await prisma.user.deleteMany({
    where: {
      role: { not: Role.OWNER },
      id: { not: owner.id }
    }
  });

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      name: resetName,
      email: resetEmail,
      username: resetUsername,
      passwordHash: await bcrypt.hash(resetPassword, 10),
      status: UserStatus.ACTIVE
    }
  });

  console.log("Demo data cleanup completed.");
  console.log(`Retained admin account: ${resetEmail}`);
  console.log(`Username: ${resetUsername}`);
  console.log(`Password: ${resetPassword}`);
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
