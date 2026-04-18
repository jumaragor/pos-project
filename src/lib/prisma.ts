import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient();
}

function isStalePrismaClient(client: PrismaClient | undefined) {
  if (!client) return true;
  return !("unitOfMeasure" in client);
}

const prismaClient =
  !isStalePrismaClient(globalForPrisma.prisma) && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : createPrismaClient();

export const prisma: PrismaClient = prismaClient;

globalForPrisma.prisma = prisma;
