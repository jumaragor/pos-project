import { NextRequest } from "next/server";
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

  return ok({
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      successfulRows: validRows.length,
      failedRows: previewRows.length - validRows.length
    }
  });
}
