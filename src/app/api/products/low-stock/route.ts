import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { stockQty: "asc" } });
  return ok(products.filter((product) => Number(product.stockQty) <= Number(product.lowStockThreshold)));
}
