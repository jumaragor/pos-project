import { NextRequest } from "next/server";
import { PurchaseStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";
import { generateProductSku, getProductSettings } from "@/lib/product-settings";
import { getInventorySettings } from "@/lib/inventory-settings";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";
import { TransactionStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const { id } = await params;
    const body = await request.json();
    const settings = await getProductSettings();
    if (
      (typeof body.unitCost === "number" ||
        typeof body.costPrice === "number" ||
        typeof body.sellingPrice === "number") &&
      !can(actor.role, "EDIT_PRICING")
    ) {
      return forbidden();
    }
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return badRequest("Product not found");
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
    if (category && category.status !== "ACTIVE" && existingProduct.categoryId !== categoryId) {
      return badRequest("Inactive categories cannot be assigned to products");
    }
    const trimmedSku = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
    if (!settings.autoGenerateSKU && !trimmedSku && !existingProduct.sku) {
      return badRequest("SKU is required");
    }
    const sku = settings.autoGenerateSKU
      ? trimmedSku || existingProduct.sku || (await generateProductSku(categoryId))
      : trimmedSku || existingProduct.sku;
    if (!sku) {
      return badRequest("SKU is required");
    }
    const normalizedBarcode = normalizeOptionalText(body.barcode);
    const unitCost =
      typeof body.unitCost === "number"
        ? body.unitCost
        : typeof body.costPrice === "number"
          ? body.costPrice
          : Number(existingProduct.costPrice);
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        sku,
        description: body.description,
        compatibleUnits: settings.enableCompatibleUnits
          ? body.compatibleUnits
          : existingProduct.compatibleUnits,
        barcode: normalizedBarcode,
        photoUrl: body.photoUrl,
        categoryId: settings.enableProductCategories ? categoryId : existingProduct.categoryId,
        category: settings.enableProductCategories ? category?.name ?? existingProduct.category : existingProduct.category,
        unit: body.unit,
        unitCost,
        costPrice: unitCost,
        sellingPrice: body.sellingPrice,
        stockQty: body.stockQty,
        allowNegativeStock: body.allowNegativeStock,
        isActive: body.isActive,
        lowStockThreshold: body.lowStockThreshold
      }
    });
    if (
      typeof body.unitCost === "number" ||
      typeof body.costPrice === "number" ||
      typeof body.sellingPrice === "number"
    ) {
      await prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "PRICE_EDIT",
          entityType: "Product",
          entityId: id,
          metadataJson: {
            unitCost,
            costPrice: unitCost,
            sellingPrice: body.sellingPrice
          }
        }
      });
    }
    return ok(product);
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
    return serverError(error instanceof Error ? error.message : "Failed to update product");
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    if (!can(actor.role, "MANAGE_USERS")) {
      return forbidden();
    }
    const { id } = await params;
    const inventorySettings = await getInventorySettings();
    if (!inventorySettings.allowProductDeletion) {
      return badRequest("Product deletion is disabled in Configuration.");
    }

    const [product, activeSalesRefCount, purchases, activeDraftRefCount] = await Promise.all([
      prisma.product.findUnique({ where: { id }, select: { stockQty: true } }),
      prisma.transactionItem.count({
        where: { productId: id, transaction: { status: TransactionStatus.COMPLETED } }
      }),
      prisma.purchase.findMany({
        where: { items: { some: { productId: id } } },
        select: { status: true, notes: true }
      }),
      prisma.purchaseItem.count({
        where: { productId: id, purchase: { status: PurchaseStatus.DRAFT } }
      })
    ]);

    if (!product) {
      return badRequest("Product not found");
    }

    const hasStock = Number(product.stockQty) !== 0;
    const activePurchaseRefCount = purchases.filter(
      (purchase) => purchase.status === PurchaseStatus.POSTED && !isVoidedPurchaseNote(purchase.notes)
    ).length;
    const hasActiveReferences =
      activeSalesRefCount > 0 || activePurchaseRefCount > 0 || activeDraftRefCount > 0;
    if (hasStock || hasActiveReferences) {
      return badRequest(
        "This item cannot be deleted because it is referenced by active sales or purchase transactions. Void the related transactions first or mark the item as inactive."
      );
    }

    await prisma.product.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return badRequest(
        "This item cannot be deleted because it is referenced by existing transaction history. Void active transactions first or mark the item as inactive."
      );
    }
    return serverError(error instanceof Error ? error.message : "Failed to delete product");
  }
}
