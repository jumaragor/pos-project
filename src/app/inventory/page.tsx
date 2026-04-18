import { prisma } from "@/lib/prisma";
import { InventoryScreen } from "@/components/inventory-screen";
import { getInventorySettings } from "@/lib/inventory-settings";
import { buildPagination, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { buildUomLookup } from "@/lib/uom-lookup";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [products, total, categoryRows, statsRows, inventorySettings] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sku: true,
        categoryId: true,
        uomId: true,
        category: true,
        description: true,
        compatibleUnits: true,
        barcode: true,
        photoUrl: true,
        unit: true,
        unitCost: true,
        sellingPrice: true,
        costPrice: true,
        stockQty: true,
        allowNegativeStock: true,
        isActive: true,
        lowStockThreshold: true
      }
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"]
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { category: true, stockQty: true, unitCost: true }
    }),
    getInventorySettings()
  ]);
  const uomLookup = await buildUomLookup(products.map((product) => product.uomId));
  return (
    <div className="grid">
      <InventoryScreen
        initialProducts={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId,
          uomId: product.uomId,
          uomCode: uomLookup.get(product.uomId ?? "")?.code ?? null,
          uomName: uomLookup.get(product.uomId ?? "")?.name ?? null,
          category: product.category,
          description: product.description ?? "",
          compatibleUnits: product.compatibleUnits ?? "",
          barcode: product.barcode ?? "",
          photoUrl: product.photoUrl ?? null,
          unit: product.unit,
          unitCost: Number(product.unitCost),
          sellingPrice: Number(product.sellingPrice),
          costPrice: Number(product.costPrice),
          stockQty: Number(product.stockQty),
          allowNegativeStock: product.allowNegativeStock,
          isActive: product.isActive,
          lowStockThreshold: Number(product.lowStockThreshold)
        }))}
        initialPagination={buildPagination(1, DEFAULT_PAGE_SIZE, total)}
        initialMetrics={{
          totalItems: statsRows.length,
          lowStockItems: inventorySettings.enableLowStockAlerts
            ? statsRows.filter((item) => Number(item.stockQty) <= inventorySettings.lowStockThreshold).length
            : 0,
          availableCategories: new Set(statsRows.map((item) => item.category).filter(Boolean)).size,
          inventoryValue: statsRows.reduce(
            (sum, item) => sum + Math.max(0, Number(item.stockQty)) * Math.max(0, Number(item.unitCost)),
            0
          )
        }}
        initialCategoryOptions={categoryRows.map((item) => item.category).filter(Boolean).sort()}
      />
    </div>
  );
}
