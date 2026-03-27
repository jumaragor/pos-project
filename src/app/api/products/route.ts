import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";
import { generateProductSku, getProductSettings } from "@/lib/product-settings";
import { getInventorySettings } from "@/lib/inventory-settings";
import { buildPagination, DEFAULT_PAGE_SIZE, parsePositiveInt } from "@/lib/pagination";

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const filter = request.nextUrl.searchParams.get("filter") ?? "active";
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
  const sortKey = request.nextUrl.searchParams.get("sortKey") ?? "name";
  const sortDir = request.nextUrl.searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const activeWhere =
    filter === "archived" ? { isActive: false } : filter === "all" ? {} : { isActive: true };
  const searchableWhere: Prisma.ProductWhereInput = {
    ...activeWhere,
    ...(category && category !== "ALL" ? { category } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { barcode: { contains: query, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sortKey === "sku"
      ? { sku: sortDir }
      : sortKey === "category"
        ? { category: sortDir }
        : sortKey === "stockQty"
          ? { stockQty: sortDir }
          : sortKey === "unitCost"
            ? { unitCost: sortDir }
          : sortKey === "sellingPrice"
            ? { sellingPrice: sortDir }
            : { name: sortDir };

  const [inventorySettings, total, products, statsRows, categoryRows] = await Promise.all([
    getInventorySettings(),
    prisma.product.count({ where: searchableWhere }),
    prisma.product.findMany({
      where: searchableWhere,
      orderBy,
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        sku: true,
        categoryId: true,
        category: true,
        description: true,
        compatibleUnits: true,
        barcode: true,
        photoUrl: true,
        unit: true,
        unitCost: true,
        sellingPrice: true,
        costPrice: true,
        stockQty: true,
        allowNegativeStock: true,
        isActive: true,
        lowStockThreshold: true
      }
    }),
    prisma.product.findMany({
      where: activeWhere,
      select: { category: true, stockQty: true, unitCost: true }
    }),
    prisma.product.findMany({
      where: activeWhere,
      select: { category: true },
      distinct: ["category"]
    })
  ]);
  const pagination = buildPagination(requestedPage, pageSize, total);
  const metrics = {
    totalItems: statsRows.length,
    lowStockItems: inventorySettings.enableLowStockAlerts
      ? statsRows.filter((item) => Number(item.stockQty) <= Math.max(0, inventorySettings.lowStockThreshold)).length
      : 0,
    availableCategories: new Set(statsRows.map((item) => item.category).filter(Boolean)).size,
    inventoryValue: statsRows.reduce(
      (sum, item) => sum + Math.max(0, Number(item.stockQty)) * Math.max(0, Number(item.unitCost)),
      0
    )
  };

  return ok({
    items: products.map((product) => ({
      ...product,
      description: product.description ?? "",
      compatibleUnits: product.compatibleUnits ?? "",
      barcode: product.barcode ?? "",
      photoUrl: product.photoUrl ?? null,
      unitCost: Number(product.unitCost),
      sellingPrice: Number(product.sellingPrice),
      costPrice: Number(product.costPrice),
      stockQty: Number(product.stockQty),
      lowStockThreshold: Number(product.lowStockThreshold)
    })),
    pagination,
    metrics,
    categoryOptions: categoryRows.map((item) => item.category).filter(Boolean).sort()
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const body = await request.json();
    const settings = await getProductSettings();
    if (!body.name || !body.unit) {
      return badRequest("name and unit are required");
    }
    if (
      typeof body.unitCost === "number" ||
      typeof body.costPrice === "number" ||
      typeof body.sellingPrice === "number"
    ) {
      if (!can(actor.role, "EDIT_PRICING")) {
        return forbidden();
      }
    }
    const categoryId = typeof body.categoryId === "string" && body.categoryId.trim() ? body.categoryId : null;
    const category = categoryId
      ? await prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, name: true, status: true }
        })
      : null;
    if (categoryId && !category) {
      return badRequest("Selected category does not exist");
    }
    if (category && category.status !== "ACTIVE") {
      return badRequest("Inactive categories cannot be assigned to new products");
    }
    const trimmedSku = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
    if (!settings.autoGenerateSKU && !trimmedSku) {
      return badRequest("SKU is required");
    }
    if (settings.autoGenerateSKU && !categoryId) {
      return badRequest("Category is required before generating SKU.");
    }
    const sku = settings.autoGenerateSKU ? await generateProductSku(categoryId) : trimmedSku;
    if (!sku) {
      return badRequest("SKU is required");
    }
    const normalizedBarcode = normalizeOptionalText(body.barcode);
    const unitCost = Number(body.unitCost ?? body.costPrice ?? 0);
    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku,
        description: body.description,
        compatibleUnits: settings.enableCompatibleUnits ? body.compatibleUnits : null,
        barcode: normalizedBarcode,
        photoUrl: body.photoUrl,
        categoryId: settings.enableProductCategories ? categoryId : null,
        category: settings.enableProductCategories ? category?.name ?? "General" : "General",
        unit: body.unit,
        unitCost,
        costPrice: unitCost,
        sellingPrice: Number(body.sellingPrice ?? 0),
        stockQty: Number(body.stockQty ?? 0),
        allowNegativeStock: Boolean(body.allowNegativeStock ?? false),
        isActive: body.isActive === false ? false : true,
        lowStockThreshold: Number(body.lowStockThreshold ?? 0)
      }
    });
    return created(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : String(error.meta?.target ?? "");
      if (target.includes("barcode")) {
        return badRequest("Barcode already exists. Please use a unique barcode or leave it blank.");
      }
      if (target.includes("sku")) {
        return badRequest("SKU already exists. Please use a unique SKU.");
      }
    }
    if (error instanceof Error && /Category is required|configured SKU prefix/i.test(error.message)) {
      return badRequest(error.message);
    }
    return serverError(error instanceof Error ? error.message : "Failed to create product");
  }
}
