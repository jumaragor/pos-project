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

  const transactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.COMPLETED,
      createdAt: { gte: from, lte: to }
    },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });

  const rows = transactions.map((tx) => ({
    id: tx.id,
    date: tx.createdAt.toISOString(),
    receiptNo: tx.number,
    items: tx.items.reduce((sum, item) => sum + Number(item.qty), 0),
    paymentMethod: tx.paymentMethod,
    total: Number(tx.totalAmount)
  }));

  return ok(rows);
}
