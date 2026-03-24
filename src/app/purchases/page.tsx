import { PurchasesScreen } from "@/components/purchases-screen";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const [purchases, products, suppliers] = await Promise.all([
    prisma.purchase.findMany({
      include: {
        items: {
          orderBy: { id: "asc" }
        }
      },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: "asc" }
    }),
    prisma.supplier.findMany({
      select: { id: true, supplierCode: true, supplierName: true, status: true },
      orderBy: { supplierName: "asc" }
    })
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
        }))}
        products={products}
        suppliers={suppliers}
      />
    </div>
  );
}
