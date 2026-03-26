import { NextRequest } from "next/server";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { generateProductSku, getProductSettings } from "@/lib/product-settings";

export async function GET(request: NextRequest) {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }

  const settings = await getProductSettings();
  if (!settings.autoGenerateSKU) {
    return badRequest("Auto Generate SKU is disabled.");
  }

  const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim();
  if (!categoryId) {
    return badRequest("Category is required for auto-generated SKU.");
  }

  try {
    const sku = await generateProductSku(categoryId);
    return ok({ sku });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to generate SKU.");
  }
}
