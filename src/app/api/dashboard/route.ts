import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [transactions, lowStock] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: start }, status: TransactionStatus.COMPLETED }
    }),
    prisma.product.findMany({ orderBy: { stockQty: "asc" } })
  ]);
  const low = lowStock.filter((product) => Number(product.stockQty) <= Number(product.lowStockThreshold));
  return ok({
    todaySales: transactions.reduce((acc, tx) => acc + Number(tx.totalAmount), 0),
    transactions: transactions.length,
    lowStockCount: low.length,
    lowStock: low
  });
}
