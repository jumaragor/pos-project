import { PurchaseStatus, StockMovementType } from "@prisma/client";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildVoidedPurchaseNote, isVoidedPurchaseNote } from "@/lib/purchase-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }

    const { id } = await params;
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!purchase) {
      return badRequest("Purchase not found");
    }
    if (isVoidedPurchaseNote(purchase.notes)) {
      return badRequest("Purchase is already voided");
    }
    if (purchase.status !== PurchaseStatus.POSTED) {
      return badRequest("Only posted purchases can be voided");
    }

    const productIds = Array.from(new Set(purchase.items.map((item) => item.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stockQty: true }
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const item of purchase.items) {
      const product = productById.get(item.productId);
      if (!product) {
        return badRequest(`Product not found for item ${item.productName}`);
      }
      if (Number(product.stockQty) < Number(item.quantity)) {
        return badRequest(
          `Cannot void purchase because stock of ${product.name} is lower than the purchased quantity to reverse.`
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } }
        });
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.ADJUSTMENT,
            productId: item.productId,
            qtyDelta: -Number(item.quantity),
            reason: `Void purchase ${purchase.purchaseNumber}`,
            refId: purchase.id,
            userId: actor.id
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "VOID_PURCHASE",
          entityType: "Purchase",
          entityId: purchase.id,
          metadataJson: { previousStatus: purchase.status }
        }
      });

      return tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PurchaseStatus.DRAFT,
          notes: buildVoidedPurchaseNote(purchase.notes)
        },
        include: { items: { orderBy: { id: "asc" } } }
      });
    });

    return ok(updated);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to void purchase");
  }
}
