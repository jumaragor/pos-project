import {
  PaymentMethod,
  PendingOpType,
  Prisma,
  Role,
  StockMovementType,
  TransactionStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/rbac";
import { computeCartTotals, DiscountInput } from "@/lib/pricing";

type SaleInput = {
  userId: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  qrAmount?: number;
  orderDiscount?: DiscountInput;
  items: Array<{
    productId: string;
    qty: number;
    itemDiscount?: DiscountInput;
  }>;
};

async function getAllowNegativeStock(tx: Prisma.TransactionClient) {
  const setting = await tx.appSetting.findUnique({ where: { key: "allowNegativeStock" } });
  return setting?.value === "true";
}

export async function createSale(input: SaleInput) {
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) } }
    });

    if (products.length !== input.items.length) {
      throw new Error("Some products were not found");
    }

    const allowNegativeStock = await getAllowNegativeStock(tx);
    const pricingLines = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        qty: item.qty,
        price: Number(product.sellingPrice),
        itemDiscount: item.itemDiscount
      };
    });
    const totals = computeCartTotals(pricingLines, input.orderDiscount);

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId)!;
      const nextStock = Number(product.stockQty) - item.qty;
      if (!allowNegativeStock && nextStock < 0) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    const count = await tx.transaction.count();
    const number = `TX-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
    const transaction = await tx.transaction.create({
      data: {
        number,
        customerId: input.customerId,
        userId: input.userId,
        totalAmount: totals.total,
        discountTotal: totals.totalDiscount,
        paymentMethod: input.paymentMethod,
        cashAmount: input.cashAmount,
        qrAmount: input.qrAmount,
        status: TransactionStatus.COMPLETED
      }
    });

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId)!;
      const subtotal = item.qty * Number(product.sellingPrice);
      await tx.transactionItem.create({
        data: {
          transactionId: transaction.id,
          productId: product.id,
          qty: item.qty,
          price: product.sellingPrice,
          costAtSale: product.costPrice,
          subtotal
        }
      });
      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: { decrement: item.qty } }
      });
      await tx.stockMovement.create({
        data: {
          type: StockMovementType.SALE,
          productId: product.id,
          qtyDelta: -item.qty,
          reason: "POS sale",
          refId: transaction.id,
          userId: input.userId
        }
      });
    }
    return transaction;
  });
}

export async function voidTransaction(transactionId: string, actorId: string, actorRole: Role) {
  assertPermission(actorRole, "VOID_REFUND");
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { items: true }
    });
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new Error("Only completed transactions can be voided");
    }
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.VOID }
    });
    for (const item of transaction.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.qty } }
      });
      await tx.stockMovement.create({
        data: {
          type: StockMovementType.REFUND,
          productId: item.productId,
          qtyDelta: item.qty,
          reason: `Void sale ${transaction.number}`,
          refId: transaction.id,
          userId: actorId
        }
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "VOID_TRANSACTION",
        entityType: "Transaction",
        entityId: transactionId,
        metadataJson: { previousStatus: transaction.status }
      }
    });
    return { success: true };
  });
}

export async function refundTransaction(transactionId: string, actorId: string, actorRole: Role) {
  assertPermission(actorRole, "VOID_REFUND");
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { items: true }
    });
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new Error("Only completed transactions can be refunded");
    }
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.REFUNDED }
    });
    for (const item of transaction.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.qty } }
      });
      await tx.stockMovement.create({
        data: {
          type: StockMovementType.REFUND,
          productId: item.productId,
          qtyDelta: item.qty,
          reason: "Transaction refund",
          refId: transaction.id,
          userId: actorId
        }
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: "REFUND_TRANSACTION",
        entityType: "Transaction",
        entityId: transactionId,
        metadataJson: { previousStatus: transaction.status }
      }
    });
    return { success: true };
  });
}

export async function pushOfflineOperations(
  userId: string,
  operations: Array<{ opId: string; type: PendingOpType; payload: Record<string, unknown> }>
) {
  const results: Array<{ opId: string; status: string; message?: string }> = [];
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }
  for (const op of operations) {
    try {
      const existing = await prisma.syncOperation.findUnique({ where: { opId: op.opId } });
      if (existing) {
        results.push({ opId: op.opId, status: "already_processed" });
        continue;
      }
      if (op.type === PendingOpType.SALE) {
        await createSale({
          userId,
          paymentMethod: op.payload.paymentMethod as PaymentMethod,
          customerId: op.payload.customerId as string | undefined,
          cashAmount: op.payload.cashAmount as number | undefined,
          qrAmount: op.payload.qrAmount as number | undefined,
          items: op.payload.items as SaleInput["items"]
        });
      } else if (op.type === PendingOpType.ADJUSTMENT) {
        assertPermission(user.role, "INVENTORY_ADJUST");
        const productId = op.payload.productId as string;
        const qtyDelta = Number(op.payload.qtyDelta);
        const reason = String(op.payload.reason ?? "Offline adjustment");
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Product not found");
          const allowNegative = (await tx.appSetting.findUnique({ where: { key: "allowNegativeStock" } }))
            ?.value;
          if (allowNegative !== "true" && Number(product.stockQty) + qtyDelta < 0) {
            throw new Error("Negative stock is not allowed");
          }
          await tx.product.update({ where: { id: productId }, data: { stockQty: { increment: qtyDelta } } });
          await tx.stockMovement.create({
            data: {
              type: StockMovementType.ADJUSTMENT,
              productId,
              qtyDelta,
              reason,
              userId
            }
          });
          await tx.auditLog.create({
            data: {
              actorUserId: userId,
              action: "STOCK_ADJUSTMENT",
              entityType: "Product",
              entityId: productId,
              metadataJson: { qtyDelta, reason, source: "offline_sync" }
            }
          });
        });
      } else if (op.type === PendingOpType.REPACK) {
        assertPermission(user.role, "INVENTORY_ADJUST");
        const sourceProductId = String(op.payload.sourceProductId);
        const targetProductId = String(op.payload.targetProductId);
        const sourceQty = Number(op.payload.sourceQty);
        const factor = Number(op.payload.factor);
        const reason = String(op.payload.reason ?? "Offline repack");
        const targetQty = sourceQty * factor;
        await prisma.$transaction(async (tx) => {
          const [source, target] = await Promise.all([
            tx.product.findUnique({ where: { id: sourceProductId } }),
            tx.product.findUnique({ where: { id: targetProductId } })
          ]);
          if (!source || !target) throw new Error("Invalid repack products");
          const allowNegative = (await tx.appSetting.findUnique({ where: { key: "allowNegativeStock" } }))
            ?.value;
          if (allowNegative !== "true" && Number(source.stockQty) - sourceQty < 0) {
            throw new Error("Insufficient source stock");
          }
          await tx.product.update({
            where: { id: sourceProductId },
            data: { stockQty: { decrement: sourceQty } }
          });
          await tx.product.update({
            where: { id: targetProductId },
            data: { stockQty: { increment: targetQty } }
          });
          await tx.stockMovement.createMany({
            data: [
              {
                type: StockMovementType.REPACK_OUT,
                productId: sourceProductId,
                qtyDelta: -sourceQty,
                reason,
                userId
              },
              {
                type: StockMovementType.REPACK_IN,
                productId: targetProductId,
                qtyDelta: targetQty,
                reason,
                userId
              }
            ]
          });
        });
      }
      await prisma.syncOperation.create({
        data: {
          opId: op.opId,
          opType: op.type,
          status: "processed",
          payloadJson: op.payload as Prisma.InputJsonValue
        }
      });
      results.push({ opId: op.opId, status: "processed" });
    } catch (error) {
      results.push({
        opId: op.opId,
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  return results;
}
