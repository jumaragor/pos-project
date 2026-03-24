import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";
import { getInventorySettings } from "@/lib/inventory-settings";

export async function GET() {
  const settings = await getInventorySettings();
  if (!settings.enableLowStockAlerts) {
    return ok([]);
  }
  const products = await prisma.product.findMany({ orderBy: { stockQty: "asc" } });
  return ok(
    products.filter((product) => Number(product.stockQty) <= Number(settings.lowStockThreshold))
  );
}
