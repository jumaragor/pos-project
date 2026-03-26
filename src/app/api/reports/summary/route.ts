import { NextRequest } from "next/server";
import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";

function rangeFromPreset(preset: string) {
  const now = new Date();
  const from = new Date(now);
  if (preset === "weekly") {
    from.setDate(now.getDate() - 7);
  } else if (preset === "monthly") {
    from.setMonth(now.getMonth() - 1);
  } else {
    from.setHours(0, 0, 0, 0);
  }
  return { from, to: now };
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  const preset = request.nextUrl.searchParams.get("preset") ?? "daily";
  const { from, to } = rangeFromPreset(preset);

  const [transactions, rawTopItems, inventory, paymentBreakdown] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: from, lte: to }, status: TransactionStatus.COMPLETED },
      include: { items: true }
    }),
    prisma.transactionItem.groupBy({
      by: ["productId"],
      where: {
        transaction: { createdAt: { gte: from, lte: to }, status: TransactionStatus.COMPLETED }
      },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 10
    }),
    prisma.product.findMany({ orderBy: { stockQty: "asc" } }),
    prisma.transaction.groupBy({
      by: ["paymentMethod"],
      _sum: { totalAmount: true },
      where: { createdAt: { gte: from, lte: to }, status: TransactionStatus.COMPLETED }
    })
  ]);

  const sales = transactions.reduce((acc, tx) => acc + Number(tx.totalAmount), 0);
  const transactionCount = transactions.length;
  const averageSale = transactionCount ? sales / transactionCount : 0;
  const profitEstimate = transactions.reduce((acc, tx) => {
    const cost = tx.items.reduce((c, item) => c + Number(item.costAtSale) * Number(item.qty), 0);
    return acc + Number(tx.totalAmount) - cost;
  }, 0);

  const productIds = rawTopItems.map((item) => item.productId);
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const topItems = rawTopItems.map((item) => ({
    productId: item.productId,
    productName: productNames.get(item.productId) ?? item.productId,
    qty: Number(item._sum.qty ?? 0),
    subtotal: Number(item._sum.subtotal ?? 0)
  }));

  const trendMap = new Map<string, number>();
  for (const tx of transactions) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    trendMap.set(key, (trendMap.get(key) ?? 0) + Number(tx.totalAmount));
  }
  const salesTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  return ok({
    from,
    to,
    sales,
    transactionCount,
    averageSale,
    salesTrend,
    topItems,
    inventory,
    paymentBreakdown,
    profitEstimate: can(user.role, "VIEW_PROFIT") ? profitEstimate : null
  });
}
