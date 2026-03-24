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
      createdAt: { gte: from, lte: to },
      customerId: { not: null }
    },
    include: { customer: true }
  });

  const grouped = new Map<string, { customerName: string; visits: number; totalSpent: number; lastVisit: string | null }>();
  for (const tx of transactions) {
    if (!tx.customerId || !tx.customer) continue;
    const existing = grouped.get(tx.customerId) ?? {
      customerName: tx.customer.name,
      visits: 0,
      totalSpent: 0,
      lastVisit: null
    };
    existing.visits += 1;
    existing.totalSpent += Number(tx.totalAmount);
    const txDate = tx.createdAt.toISOString();
    if (!existing.lastVisit || txDate > existing.lastVisit) {
      existing.lastVisit = txDate;
    }
    grouped.set(tx.customerId, existing);
  }

  const rows = Array.from(grouped.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  return ok(rows);
}
