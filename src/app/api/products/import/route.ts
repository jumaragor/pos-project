import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/http";
import { validateInventoryImportRows } from "@/lib/inventory-import";
import { getProductSettings } from "@/lib/product-settings";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return forbidden();
  }

  const body = await request.json();
  if (!Array.isArray(body.rows)) {
    return badRequest("rows array is required");
  }

  const settings = await getProductSettings();
  const { previewRows, validRows } = await validateInventoryImportRows(body.rows, settings);

  if (!validRows.length) {
    return ok({
      summary: {
        totalRows: previewRows.length,
        successfulRows: 0,
        failedRows: previewRows.length
      },
      failures: previewRows.filter((row) => row.errors.length > 0)
    });
  }

  await prisma.$transaction(
    validRows.map((row) =>
      prisma.product.create({
        data: {
          sku: row.sku,
          name: row.name,
          categoryId: settings.enableProductCategories ? row.categoryId : null,
          category: settings.enableProductCategories ? row.categoryName : "General",
          description: row.description || null,
          compatibleUnits: settings.enableCompatibleUnits ? row.compatibleUnits || null : null,
          unit: "pc",
          costPrice: row.price,
          sellingPrice: row.price,
          stockQty: row.stockQty,
          allowNegativeStock: false,
          isActive: row.isActive,
          lowStockThreshold: 0
        }
      })
    )
  );

  return ok({
    summary: {
      totalRows: previewRows.length,
      successfulRows: validRows.length,
      failedRows: previewRows.length - validRows.length
    },
    failures: previewRows.filter((row) => row.errors.length > 0)
  });
}
