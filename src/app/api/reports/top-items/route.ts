import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const topItems = await prisma.transactionItem.groupBy({
    by: ["productId"],
    _sum: { qty: true, subtotal: true },
    orderBy: { _sum: { qty: "desc" } },
    take: 20
  });
  return ok(topItems);
}
