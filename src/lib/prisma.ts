import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? "";
  try {
    const url = new URL(base);
    // Fail fast on connect rather than hanging indefinitely.
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "5");
    }
    // Kill any individual statement that runs longer than 10 s at the
    // Postgres level so the driver never blocks the Node event loop.
    if (!url.searchParams.has("statement_timeout")) {
      url.searchParams.set("statement_timeout", "10000");
    }
    return url.toString();
  } catch {
    // If the URL is malformed, return it unchanged and let Prisma surface
    // the real error.
    return base;
  }
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url: buildDatabaseUrl() }
    },
    // Fail fast when the TCP connection to Postgres cannot be established.
    // This surfaces a clear error instead of a silent hang.
    // @ts-expect-error — connectTimeoutMs is a valid Prisma 5 option but is
    // not yet reflected in the generated types for all adapters.
    connectTimeoutMs: 5000
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
