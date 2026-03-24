import { prisma } from "@/lib/prisma";
import { PosWorkspace } from "@/components/pos/pos-workspace";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const [products, customers] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <div className="grid">
      <PosWorkspace
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
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
