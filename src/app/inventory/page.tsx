import { prisma } from "@/lib/prisma";
import { InventoryScreen } from "@/components/inventory-screen";

export default async function InventoryPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
  return (
    <div className="grid">
      <InventoryScreen
        initialProducts={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          description: product.description ?? "",
          compatibleUnits: product.compatibleUnits ?? "",
          barcode: product.barcode ?? "",
          photoUrl: product.photoUrl ?? null,
          unit: product.unit,
          sellingPrice: Number(product.sellingPrice),
          costPrice: Number(product.costPrice),
          stockQty: Number(product.stockQty),
          allowNegativeStock: product.allowNegativeStock,
          isActive: product.isActive,
          lowStockThreshold: Number(product.lowStockThreshold)
        }))}
      />
    </div>
  );
}
