import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError } from "@/lib/http";

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows = body.rows as Array<Record<string, string>>;
    if (!Array.isArray(rows)) {
      return badRequest("rows array is required");
    }
    const created = [];
    for (const row of rows) {
      const categoryName = row.category ?? "General";
      const normalizedBarcode = normalizeOptionalText(row.barcode);
      const category = await prisma.category.findFirst({
        where: { name: { equals: categoryName, mode: "insensitive" } },
        select: { id: true, name: true }
      });
      const product = await prisma.product.upsert({
        where: { sku: row.sku },
        update: {
          name: row.name,
          barcode: normalizedBarcode,
          categoryId: category?.id ?? null,
          category: category?.name ?? categoryName,
          unit: row.unit ?? "pc",
          unitCost: Number(row.cost_price ?? row.selling_price ?? 0),
          costPrice: Number(row.cost_price ?? 0),
          sellingPrice: Number(row.selling_price ?? 0),
          stockQty: Number(row.stock_qty ?? 0),
          lowStockThreshold: Number(row.low_stock_threshold ?? 0)
        },
        create: {
          name: row.name,
          sku: row.sku,
          barcode: normalizedBarcode,
          categoryId: category?.id ?? null,
          category: category?.name ?? categoryName,
          unit: row.unit ?? "pc",
          unitCost: Number(row.cost_price ?? row.selling_price ?? 0),
          costPrice: Number(row.cost_price ?? 0),
          sellingPrice: Number(row.selling_price ?? 0),
          stockQty: Number(row.stock_qty ?? 0),
          lowStockThreshold: Number(row.low_stock_threshold ?? 0)
        }
      });
      created.push(product);
    }
    return ok({ count: created.length });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to import");
  }
}
