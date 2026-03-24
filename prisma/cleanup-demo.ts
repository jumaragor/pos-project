import bcrypt from "bcryptjs";
import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureOwnerAccount() {
  const owner = await prisma.user.findFirst({
    where: { role: Role.OWNER },
    orderBy: { createdAt: "asc" }
  });

  if (owner) {
    return owner;
  }

  const passwordHash = await bcrypt.hash("Owner123!", 10);
  return prisma.user.create({
    data: {
      name: "Owner Demo",
      email: "owner@microbiz.local",
      username: "owner",
      passwordHash,
      role: Role.OWNER
    }
  });
}

async function main() {
  const owner = await ensureOwnerAccount();

  await prisma.$transaction(async (tx) => {
    await tx.syncOperation.deleteMany();

    await tx.stockMovement.deleteMany();
    await tx.transactionItem.deleteMany();
    await tx.transaction.deleteMany();

    await tx.purchaseItem.deleteMany();
    await tx.purchase.deleteMany();

    await tx.unitConversionRule.deleteMany();
    await tx.product.deleteMany();

    await tx.supplier.deleteMany();
    await tx.customer.deleteMany();

    await tx.auditLog.deleteMany({
      where: {
        OR: [{ entityType: "Transaction" }, { entityType: "Purchase" }, { entityType: "Product" }]
      }
    });
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
      status: UserStatus.ACTIVE
    }
  });

  console.log("Demo data cleanup completed.");
  console.log(`Retained admin account: ${owner.email}`);
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
