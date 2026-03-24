import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";
import { getInventorySettings } from "@/lib/inventory-settings";

export async function GET() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const completedWhere = { createdAt: { gte: start }, status: TransactionStatus.COMPLETED };
  const [transactions, products, inventorySettings] = await Promise.all([
    prisma.transaction.findMany({
      where: completedWhere,
      select: { totalAmount: true }
    }),
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, stockQty: true },
      orderBy: { stockQty: "asc" },
      take: 8
    }),
    getInventorySettings()
  ]);
  const low = inventorySettings.enableLowStockAlerts
    ? products.filter((product) => Number(product.stockQty) <= inventorySettings.lowStockThreshold)
    : [];
  return ok({
    todaySales: transactions.reduce((acc, tx) => acc + Number(tx.totalAmount), 0),
    transactions: transactions.length,
    lowStockCount: low.length,
    lowStock: low
  });
}
