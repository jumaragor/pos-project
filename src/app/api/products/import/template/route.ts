import * as XLSX from "xlsx";
import { getAuthUser } from "@/lib/api-auth";
import { forbidden, unauthorized } from "@/lib/http";
import { inventoryImportColumns } from "@/lib/inventory-import";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return forbidden();
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    {
      SKU: "GEN-0001",
      "Product Name": "Sample Product",
      Category: "General",
      Description: "Sample description",
      "Unit Cost": 80,
      Price: 100,
      "Current Stock": 25,
      "Compatible Units": "",
      "Active Status": "Active"
    }
  ], {
    header: [...inventoryImportColumns]
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Template");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-import-template.xlsx"`
    }
  });
}
