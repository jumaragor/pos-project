import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const data = await prisma.transaction.findMany({
    select: {
      id: true,
      number: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      user: { select: { name: true, username: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return ok(data);
}
