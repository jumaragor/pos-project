import { prisma } from "@/lib/prisma";
import { PosWorkspace } from "@/components/pos/pos-workspace";
import { buildUomLookup } from "@/lib/uom-lookup";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const [products, customers] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        uomId: true,
        category: true,
        compatibleUnits: true,
        barcode: true,
        photoUrl: true,
        sellingPrice: true,
        stockQty: true,
        lowStockThreshold: true
      }
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } })
  ]);
  const uomLookup = await buildUomLookup(products.map((product) => product.uomId));
  return (
    <div className="grid">
      <PosWorkspace
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          uomCode: uomLookup.get(product.uomId ?? "")?.code ?? null,
          uomName: uomLookup.get(product.uomId ?? "")?.name ?? null,
          compatibleUnits: product.compatibleUnits,
          barcode: product.barcode,
          photoUrl: product.photoUrl,
          sellingPrice: Number(product.sellingPrice),
          stockQty: Number(product.stockQty),
          lowStockThreshold: Number(product.lowStockThreshold)
        }))}
        customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
      />
    </div>
  );
}
