import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows = body.rows as Array<Record<string, string>>;
    if (!Array.isArray(rows)) {
      return badRequest("rows array is required");
    }
    const created = [];
    for (const row of rows) {
      const product = await prisma.product.upsert({
        where: { sku: row.sku },
        update: {
          name: row.name,
          barcode: row.barcode,
          category: row.category ?? "General",
          unit: row.unit ?? "pc",
          costPrice: Number(row.cost_price ?? 0),
          sellingPrice: Number(row.selling_price ?? 0),
          stockQty: Number(row.stock_qty ?? 0),
          lowStockThreshold: Number(row.low_stock_threshold ?? 0)
        },
        create: {
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          category: row.category ?? "General",
          unit: row.unit ?? "pc",
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
