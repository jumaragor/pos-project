import { NextRequest } from "next/server";
import { PurchaseStatus } from "@prisma/client";
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

  const purchases = await prisma.purchase.findMany({
    where: {
      purchaseDate: { gte: from, lte: to },
      status: PurchaseStatus.POSTED
    },
    orderBy: { purchaseDate: "desc" }
  });

  const rows = purchases.map((purchase) => ({
    id: purchase.id,
    date: purchase.purchaseDate.toISOString(),
    supplier: purchase.supplierName || "-",
    items: Number(purchase.totalItems),
    totalCost: Number(purchase.totalCost)
  }));

  return ok(rows);
}
