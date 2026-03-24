import { PendingOpType, Prisma, Role, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/rbac";

export async function stockInProduct(params: {
  productId: string;
  qty: number;
  reason?: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) {
      throw new Error("Product not found");
    }
    await tx.product.update({
      where: { id: product.id },
      data: { stockQty: { increment: params.qty } }
    });
    return tx.stockMovement.create({
      data: {
        type: StockMovementType.STOCK_IN,
        productId: product.id,
        qtyDelta: params.qty,
        reason: params.reason ?? "Stock in",
        userId: params.userId
      }
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
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) {
      throw new Error("Product not found");
    }
    const next = Number(product.stockQty) + params.qtyDelta;
    const allowNegative = (await tx.appSetting.findUnique({ where: { key: "allowNegativeStock" } }))?.value;
    if (allowNegative !== "true" && next < 0) {
      throw new Error("Negative stock is not allowed");
    }
    await tx.product.update({
      where: { id: product.id },
      data: { stockQty: { increment: params.qtyDelta } }
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
    return tx.stockMovement.create({
      data: {
        type: StockMovementType.ADJUSTMENT,
        productId: product.id,
        qtyDelta: params.qtyDelta,
        reason: params.reason,
        userId: params.userId
      }
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
  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.product.findUnique({ where: { id: params.sourceProductId } }),
      tx.product.findUnique({ where: { id: params.targetProductId } })
    ]);
    if (!source || !target) {
      throw new Error("Invalid source/target product");
    }
    const targetQty = params.sourceQty * params.factor;
    const allowNegative = (await tx.appSetting.findUnique({ where: { key: "allowNegativeStock" } }))?.value;
    if (allowNegative !== "true" && Number(source.stockQty) - params.sourceQty < 0) {
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
        reason: params.reason ?? "Repack",
        userId: params.userId
      }
    });
    await tx.stockMovement.create({
      data: {
        type: StockMovementType.REPACK_IN,
        productId: target.id,
        qtyDelta: targetQty,
        reason: params.reason ?? "Repack",
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
