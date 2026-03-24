import { NextRequest } from "next/server";
import { PurchaseStatus, TransactionStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const { id } = await params;
    const body = await request.json();
    if (
      (typeof body.costPrice === "number" || typeof body.sellingPrice === "number") &&
      !can(actor.role, "EDIT_PRICING")
    ) {
      return forbidden();
    }
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        sku: body.sku,
        description: body.description,
        compatibleUnits: body.compatibleUnits,
        barcode: body.barcode,
        photoUrl: body.photoUrl,
        category: body.category,
        unit: body.unit,
        costPrice: body.costPrice,
        sellingPrice: body.sellingPrice,
        stockQty: body.stockQty,
        allowNegativeStock: body.allowNegativeStock,
        isActive: body.isActive,
        lowStockThreshold: body.lowStockThreshold
      }
    });
    if (typeof body.costPrice === "number" || typeof body.sellingPrice === "number") {
      await prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "PRICE_EDIT",
          entityType: "Product",
          entityId: id,
          metadataJson: { costPrice: body.costPrice, sellingPrice: body.sellingPrice }
        }
      });
    }
    return ok(product);
  } catch (error) {
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

    const [product, salesRefCount, purchaseRefCount, movementRefCount, activeDraftRefCount] = await Promise.all([
      prisma.product.findUnique({ where: { id }, select: { stockQty: true } }),
      prisma.transactionItem.count({ where: { productId: id } }),
      prisma.purchaseItem.count({ where: { productId: id } }),
      prisma.stockMovement.count({ where: { productId: id } }),
      prisma.purchaseItem.count({
        where: { productId: id, purchase: { status: PurchaseStatus.DRAFT } }
      })
    ]);

    if (!product) {
      return badRequest("Product not found");
    }

    const hasStock = Number(product.stockQty) !== 0;
    const hasHistory =
      salesRefCount > 0 || purchaseRefCount > 0 || movementRefCount > 0 || activeDraftRefCount > 0;
    if (hasStock || hasHistory) {
      return badRequest(
        "This item cannot be permanently deleted because it has inventory or transaction history. Archive it instead."
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
