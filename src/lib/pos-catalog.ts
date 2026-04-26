import { prisma } from "@/lib/prisma";
import { buildPagination } from "@/lib/pagination";
import { buildUomLookup } from "@/lib/uom-lookup";

export type PosCatalogItem = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  uomCode: string | null;
  uomName: string | null;
  compatibleUnits: string | null;
  barcode: string | null;
  photoUrl: string | null;
  sellingPrice: number;
  stockQty: number;
  lowStockThreshold: number;
};

export async function listPosCatalog({
  page,
  pageSize,
  query,
  category
}: {
  page: number;
  pageSize: number;
  query?: string;
  category?: string;
}) {
  const trimmedQuery = query?.trim();
  const where = {
    isActive: true,
    ...(category && category !== "All" ? { category } : {}),
    ...(trimmedQuery
      ? {
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" as const } },
            { sku: { contains: trimmedQuery, mode: "insensitive" as const } },
            { barcode: { contains: trimmedQuery, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    })
  ]);

  const uomLookup = await buildUomLookup(products.map((product) => product.uomId));

  return {
    items: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      uomCode: uomLookup.get(product.uomId ?? "")?.code ?? null,
      uomName: uomLookup.get(product.uomId ?? "")?.name ?? null,
      compatibleUnits: product.compatibleUnits ?? null,
      barcode: product.barcode ?? null,
      photoUrl: product.photoUrl ?? null,
      sellingPrice: Number(product.sellingPrice),
      stockQty: Number(product.stockQty),
      lowStockThreshold: Number(product.lowStockThreshold)
    })) satisfies PosCatalogItem[],
    pagination: buildPagination(page, pageSize, total)
  };
}

export async function listPosCategories() {
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" }
  });

  return rows.map((row) => row.category).filter(Boolean) as string[];
}
