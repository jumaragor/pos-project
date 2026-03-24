import { PurchasesScreen } from "@/components/purchases-screen";
import { prisma } from "@/lib/prisma";
import { buildPagination, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
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
      take: DEFAULT_PAGE_SIZE
    }),
    prisma.purchase.count()
  ]);

  return (
    <div className="grid">
      <PurchasesScreen
        initialPurchases={purchases.map((purchase) => ({
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
          items: []
        }))}
        initialPagination={buildPagination(1, DEFAULT_PAGE_SIZE, purchaseTotal)}
      />
    </div>
  );
}
