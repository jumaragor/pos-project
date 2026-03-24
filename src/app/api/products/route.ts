import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const filter = request.nextUrl.searchParams.get("filter") ?? "active";
  const activeWhere =
    filter === "archived" ? { isActive: false } : filter === "all" ? {} : { isActive: true };
  const products = await prisma.product.findMany({
    where: {
      ...activeWhere,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { barcode: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: { name: "asc" }
  });
  return ok(products);
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const body = await request.json();
    if (!body.name || !body.sku || !body.unit) {
      return badRequest("name, sku, and unit are required");
    }
    if ((body.costPrice || body.sellingPrice) && !can(actor.role, "EDIT_PRICING")) {
      return forbidden();
    }
    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        description: body.description,
        compatibleUnits: body.compatibleUnits,
        barcode: body.barcode,
        photoUrl: body.photoUrl,
        category: body.category ?? "General",
        unit: body.unit,
        costPrice: Number(body.costPrice ?? 0),
        sellingPrice: Number(body.sellingPrice ?? 0),
        stockQty: Number(body.stockQty ?? 0),
        allowNegativeStock: Boolean(body.allowNegativeStock ?? false),
        isActive: body.isActive === false ? false : true,
        lowStockThreshold: Number(body.lowStockThreshold ?? 0)
      }
    });
    return created(product);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create product");
  }
}
