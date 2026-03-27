import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";
import { forbidden, unauthorized } from "@/lib/http";
import { toInventoryExportRows } from "@/lib/inventory-import";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return forbidden();
  }

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      sku: true,
      name: true,
      category: true,
      description: true,
      unitCost: true,
      sellingPrice: true,
      stockQty: true,
      compatibleUnits: true,
      isActive: true
    }
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(toInventoryExportRows(products));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-export.xlsx"`
    }
  });
}
