import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { category: "asc" }
  });
  return ok(products);
}
