import { prisma } from "@/lib/prisma";
import type { PurchaseDetailRow, PurchaseSummaryRow } from "@/components/purchases/types";

export async function getPurchaseSummaries(take: number) {
  const [purchases, purchaseTotal] = await Promise.all([
    prisma.purchase.findMany({
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        supplierId: true,
        supplierName: true,
        referenceNumber: true,
        notes: true,
        totalItems: true,
        totalCost: true,
        status: true
      },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
      take
    }),
    prisma.purchase.count()
  ]);

  const items: PurchaseSummaryRow[] = purchases.map((purchase) => ({
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    purchaseDate: purchase.purchaseDate.toISOString(),
    supplierId: purchase.supplierId,
    supplierName: purchase.supplierName,
    referenceNumber: purchase.referenceNumber,
    notes: purchase.notes,
    totalItems: Number(purchase.totalItems),
    totalCost: Number(purchase.totalCost),
    status: purchase.status
  }));

  return { items, total: purchaseTotal };
}

export async function getPurchaseDetail(id: string): Promise<PurchaseDetailRow | null> {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      purchaseNumber: true,
      purchaseDate: true,
      supplierId: true,
      supplierName: true,
      referenceNumber: true,
      notes: true,
      totalItems: true,
      totalCost: true,
      status: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          unitCost: true,
          amount: true,
          taxRate: true,
          taxAmount: true,
          lineTotal: true
        }
      }
    }
  });

  if (!purchase) return null;

  return {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    purchaseDate: purchase.purchaseDate.toISOString(),
    supplierId: purchase.supplierId,
    supplierName: purchase.supplierName,
    referenceNumber: purchase.referenceNumber,
    notes: purchase.notes,
    totalItems: Number(purchase.totalItems),
    totalCost: Number(purchase.totalCost),
    status: purchase.status,
    items: purchase.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      amount: Number(item.amount),
      taxRate: Number(item.taxRate),
      taxAmount: Number(item.taxAmount),
      lineTotal: Number(item.lineTotal)
    }))
  };
}
