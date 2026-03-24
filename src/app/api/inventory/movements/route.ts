import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const data = await prisma.stockMovement.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      user: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return ok(data);
}
