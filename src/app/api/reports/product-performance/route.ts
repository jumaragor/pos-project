import { NextRequest } from "next/server";
import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

function parseDateInput(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(request: NextRequest) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = parseDateInput(request.nextUrl.searchParams.get("from"), monthStart);
  const to = parseDateInput(request.nextUrl.searchParams.get("to"), now);

  const items = await prisma.transactionItem.findMany({
    where: {
      transaction: {
        status: TransactionStatus.COMPLETED,
        createdAt: { gte: from, lte: to }
      }
    },
    include: { product: true }
  });

  const grouped = new Map<string, { productName: string; quantitySold: number; revenue: number; profit: number }>();
  for (const item of items) {
    const key = item.productId;
    const existing = grouped.get(key) ?? {
      productName: item.product.name,
      quantitySold: 0,
      revenue: 0,
      profit: 0
    };
    const qty = Number(item.qty);
    const revenue = Number(item.subtotal);
    const cost = Number(item.costAtSale) * qty;
    existing.quantitySold += qty;
    existing.revenue += revenue;
    existing.profit += revenue - cost;
    grouped.set(key, existing);
  }

  const rows = Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  return ok(rows);
}
