import {
  InventoryReferenceType,
  PendingOpType,
  Prisma,
  Role,
  StockMovementType
} from "@prisma/client";
import { applyInventoryAdjustment, applyPurchaseReceipt } from "@/lib/inventory-valuation";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/rbac";
import { getInventorySettings } from "@/lib/inventory-settings";

export async function stockInProduct(params: {
  productId: string;
  qty: number;
  unitCost?: number;
  reason?: string;
  userId: string;
}) {
  const settings = await getInventorySettings();
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) {
      throw new Error("Product not found");
    }
    await applyPurchaseReceipt(tx, {
      productId: product.id,
      quantity: params.qty,
      unitCost: params.unitCost ?? product.unitCost,
      reason: params.reason ?? "Stock in",
      referenceType: InventoryReferenceType.ADJUSTMENT,
      userId: params.userId,
      method: settings.inventoryValuationMethod
    });
    return tx.stockMovement.findFirstOrThrow({
      where: {
        productId: product.id,
        userId: params.userId,
        type: StockMovementType.STOCK_IN
      },
      orderBy: { createdAt: "desc" }
    });
  });
}

export async function adjustStock(params: {
  productId: string;
  qtyDelta: number;
  reason: string;
  userId: string;
  role: Role;
}) {
  assertPermission(params.role, "INVENTORY_ADJUST");
  const settings = await getInventorySettings();
  if (!settings.allowManualStockAdjustments) {
    throw new Error("Manual stock adjustments are disabled");
  }
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) {
      throw new Error("Product not found");
    }
    const next = Number(product.stockQty) + params.qtyDelta;
    if (!settings.allowNegativeStock && next < 0) {
      throw new Error("Insufficient stock");
    }
    await applyInventoryAdjustment(tx, {
      productId: product.id,
      quantity: params.qtyDelta,
      reason: params.reason,
      referenceType: InventoryReferenceType.ADJUSTMENT,
      userId: params.userId,
      method: settings.inventoryValuationMethod
    });
    await tx.auditLog.create({
      data: {
        actorUserId: params.userId,
        action: "STOCK_ADJUSTMENT",
        entityType: "Product",
        entityId: product.id,
        metadataJson: { qtyDelta: params.qtyDelta, reason: params.reason }
      }
    });
    return tx.stockMovement.findFirstOrThrow({
      where: {
        productId: product.id,
        userId: params.userId,
        type: StockMovementType.ADJUSTMENT
      },
      orderBy: { createdAt: "desc" }
    });
  });
}

export async function repackStock(params: {
  sourceProductId: string;
  targetProductId: string;
  sourceQty: number;
  factor: number;
  reason?: string;
  userId: string;
  role: Role;
}) {
  assertPermission(params.role, "INVENTORY_ADJUST");
  const settings = await getInventorySettings();
  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.product.findUnique({ where: { id: params.sourceProductId } }),
      tx.product.findUnique({ where: { id: params.targetProductId } })
    ]);
    if (!source || !target) {
      throw new Error("Invalid source/target product");
    }
    const targetQty = params.sourceQty * params.factor;
    if (!settings.allowNegativeStock && Number(source.stockQty) - params.sourceQty < 0) {
      throw new Error("Insufficient source stock");
    }
    await tx.product.update({
      where: { id: source.id },
      data: { stockQty: { decrement: params.sourceQty } }
    });
    await tx.product.update({
      where: { id: target.id },
      data: { stockQty: { increment: targetQty } }
    });
    await tx.stockMovement.create({
      data: {
        type: StockMovementType.REPACK_OUT,
        productId: source.id,
        qtyDelta: -params.sourceQty,
        unitCost: source.unitCost,
        reason: params.reason ?? "Repack",
        referenceType: InventoryReferenceType.REPACK,
        userId: params.userId
      }
    });
    await tx.stockMovement.create({
      data: {
        type: StockMovementType.REPACK_IN,
        productId: target.id,
        qtyDelta: targetQty,
        unitCost: target.unitCost,
        reason: params.reason ?? "Repack",
        referenceType: InventoryReferenceType.REPACK,
        userId: params.userId
      }
    });
    await tx.syncOperation.create({
      data: {
        opId: crypto.randomUUID(),
        opType: PendingOpType.REPACK,
        status: "server_record",
        payloadJson: params as unknown as Prisma.InputJsonValue
      }
    });
    return { success: true };
  });
}
