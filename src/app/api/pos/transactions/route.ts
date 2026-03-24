import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const data = await prisma.transaction.findMany({
    include: { user: { select: { name: true } }, customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return ok(data);
}
