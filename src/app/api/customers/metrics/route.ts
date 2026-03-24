import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const grouped = await prisma.transaction.groupBy({
    by: ["customerId"],
    where: { customerId: { not: null } },
    _sum: { totalAmount: true },
    _count: { _all: true },
    _max: { createdAt: true }
  });

  const payload = grouped
    .filter((item) => item.customerId)
    .map((item) => ({
      customerId: item.customerId as string,
      totalPurchases: Number(item._sum.totalAmount ?? 0),
      totalVisits: item._count._all,
      lastVisit: item._max.createdAt?.toISOString() ?? null
    }));

  return ok(payload);
}
