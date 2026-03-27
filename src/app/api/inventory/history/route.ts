import { StockMovementType } from "@prisma/client";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

function mapHistoryType(type: StockMovementType) {
  switch (type) {
    case StockMovementType.SALE:
      return "Sale";
    case StockMovementType.STOCK_IN:
      return "Purchase";
    case StockMovementType.ADJUSTMENT:
      return "Adjust";
    case StockMovementType.REFUND:
      return "Reverse";
    case StockMovementType.REPACK_IN:
      return "Repack In";
    case StockMovementType.REPACK_OUT:
      return "Repack Out";
    default:
      return type;
  }
}

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();
  if (!productId) {
    return badRequest("productId is required");
  }

  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      qtyDelta: true,
      unitCost: true,
      reason: true,
      refId: true,
      referenceType: true,
      createdAt: true
    }
  });

  const transactionReferenceIds = movements
    .filter((movement) => movement.referenceType === "SALE")
    .map((movement) => movement.refId)
    .filter(Boolean) as string[];
  const purchaseReferenceIds = movements
    .filter((movement) => movement.referenceType === "PURCHASE")
    .map((movement) => movement.refId)
    .filter(Boolean) as string[];
  const [transactions, purchases] = await Promise.all([
    prisma.transaction.findMany({
      where: { id: { in: transactionReferenceIds } },
      select: { id: true, number: true }
    }),
    prisma.purchase.findMany({
      where: { id: { in: purchaseReferenceIds } },
      select: { id: true, purchaseNumber: true }
    })
  ]);

  const transactionById = new Map(transactions.map((item) => [item.id, item.number]));
  const purchaseById = new Map(purchases.map((item) => [item.id, item.purchaseNumber]));

  return ok({
    items: movements.map((movement) => ({
      id: movement.id,
      date: movement.createdAt.toISOString(),
      type: mapHistoryType(movement.type),
      quantityChange: Number(movement.qtyDelta),
      unitCost: movement.unitCost == null ? null : Number(movement.unitCost),
      reference:
        transactionById.get(movement.refId ?? "") ??
        purchaseById.get(movement.refId ?? "") ??
        movement.reason ??
        "-"
    }))
  });
}
