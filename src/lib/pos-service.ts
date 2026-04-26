import {
  InventoryReferenceType,
  PaymentMethod,
  PendingOpType,
  Prisma,
  Role,
  StockMovementType,
  TransactionStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateSaleNumber } from "@/lib/document-sequences";
import {
  applyInventoryAdjustment,
  applySaleIssue,
  reverseSaleIssue
} from "@/lib/inventory-valuation";
import { assertPermission } from "@/lib/rbac";
import { computeCartTotals, DiscountInput } from "@/lib/pricing";
import { getInventorySettings } from "@/lib/inventory-settings";

type SaleItemInput = {
  productId: string;
  qty: number;
  price?: number;
  itemDiscount?: DiscountInput;
};

type SaleInput = {
  userId: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  qrAmount?: number;
  orderDiscount?: DiscountInput;
  draftId?: string;
  items: SaleItemInput[];
};

type DraftSaleInput = {
  userId: string;
  customerId?: string;
  paymentMethod?: PaymentMethod;
  draftId?: string;
  orderDiscount?: DiscountInput;
  items: SaleItemInput[];
};

type PreparedItem = {
  productId: string;
  qty: number;
  price: number;
  costAtSale: Prisma.Decimal;
  subtotal: number;
};

async function loadProductsForItems(
  tx: Prisma.TransactionClient,
  items: SaleItemInput[]
) {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } }
  });

  if (products.length !== items.length) {
    throw new Error("Some products were not found");
  }

  return products;
}

function prepareSaleItems(products: Awaited<ReturnType<typeof loadProductsForItems>>, items: SaleItemInput[]) {
  return items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) {
      throw new Error("Some products were not found");
    }
    const price = Number.isFinite(item.price) ? Number(item.price) : Number(product.sellingPrice);
    const qty = Math.max(0, Number(item.qty));
    return {
      productId: product.id,
      qty,
      price,
      costAtSale: new Prisma.Decimal(product.unitCost),
      subtotal: qty * price
    } satisfies PreparedItem;
  });
}

async function createOrUpdateDraftTransaction(
  tx: Prisma.TransactionClient,
  input: DraftSaleInput
) {
  const products = await loadProductsForItems(tx, input.items);
  const preparedItems = prepareSaleItems(products, input.items);
  const totals = computeCartTotals(
    input.items.map((item, index) => ({
      qty: preparedItems[index].qty,
      price: preparedItems[index].price,
      itemDiscount: item.itemDiscount
    })),
    input.orderDiscount
  );

  let transaction;
  if (input.draftId) {
    const existingDraft = await tx.transaction.findUnique({
      where: { id: input.draftId },
      include: { items: true }
    });
    if (!existingDraft || existingDraft.status !== TransactionStatus.DRAFT) {
      throw new Error("Held order not found");
    }
    transaction = await tx.transaction.update({
      where: { id: input.draftId },
      data: {
        customerId: input.customerId,
        userId: input.userId,
        totalAmount: totals.total,
        discountTotal: totals.totalDiscount,
        paymentMethod: input.paymentMethod ?? existingDraft.paymentMethod,
        cashAmount: null,
        qrAmount: null,
        status: TransactionStatus.DRAFT
      }
    });
    await tx.transactionItem.deleteMany({ where: { transactionId: existingDraft.id } });
  } else {
    const count = await tx.transaction.count({ where: { status: TransactionStatus.DRAFT } });
    const number = `HLD-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
    transaction = await tx.transaction.create({
      data: {
        number,
        customerId: input.customerId,
        userId: input.userId,
        totalAmount: totals.total,
        discountTotal: totals.totalDiscount,
        paymentMethod: input.paymentMethod ?? PaymentMethod.CASH,
        status: TransactionStatus.DRAFT
      }
    });
  }

  for (const item of preparedItems) {
    await tx.transactionItem.create({
      data: {
        transactionId: transaction.id,
        productId: item.productId,
        qty: item.qty,
        price: item.price,
        costAtSale: item.costAtSale,
        subtotal: item.subtotal
      }
    });
  }

  return transaction;
}

export async function saveDraftSale(input: DraftSaleInput) {
  return prisma.$transaction(async (tx) => createOrUpdateDraftTransaction(tx, input), {
    maxWait: 10_000,
    timeout: 20_000
  });
}

export async function createSale(input: SaleInput) {
  const inventorySettings = await getInventorySettings();
  return prisma.$transaction(
    async (tx) => {
      const products = await loadProductsForItems(tx, input.items);
      const preparedItems = prepareSaleItems(products, input.items);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const totals = computeCartTotals(
        input.items.map((item, index) => ({
          qty: preparedItems[index].qty,
          price: preparedItems[index].price,
          itemDiscount: item.itemDiscount
        })),
        input.orderDiscount
      );

      for (const item of preparedItems) {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new Error("Some products were not found");
        }
        const nextStock = Number(product.stockQty) - item.qty;
        if (!inventorySettings.allowNegativeStock && nextStock < 0) {
          throw new Error("Insufficient stock");
        }
      }

      let transaction;
      if (input.draftId) {
        const existingDraft = await tx.transaction.findUnique({
          where: { id: input.draftId },
          include: { items: true }
        });
        if (!existingDraft || existingDraft.status !== TransactionStatus.DRAFT) {
          throw new Error("Held order not found");
        }
        await tx.transactionItem.deleteMany({ where: { transactionId: existingDraft.id } });
        transaction = await tx.transaction.update({
          where: { id: existingDraft.id },
          data: {
            number:
              existingDraft.number.startsWith("HLD-")
                ? await generateSaleNumber(tx)
                : existingDraft.number,
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
      } else {
        const number = await generateSaleNumber(tx);
        transaction = await tx.transaction.create({
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
      }

      for (const item of preparedItems) {
        const unitCost = await applySaleIssue(tx, {
          productId: item.productId,
          quantity: item.qty,
          reason: input.draftId ? "Completed held POS sale" : "POS sale",
          referenceId: transaction.id,
          referenceType: InventoryReferenceType.SALE,
          userId: input.userId,
          method: inventorySettings.inventoryValuationMethod
        });
        await tx.transactionItem.create({
          data: {
            transactionId: transaction.id,
            productId: item.productId,
            qty: item.qty,
            price: item.price,
            costAtSale: unitCost,
            subtotal: item.subtotal
          }
        });
      }

      return transaction;
    },
    {
      maxWait: 10_000,
      timeout: 20_000
    }
  );
}

export async function getHeldTransaction(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, isActive: true } }
        }
      }
    }
  });

  if (!transaction || transaction.status !== TransactionStatus.DRAFT) {
    throw new Error("Held order not found");
  }

  return {
    id: transaction.id,
    number: transaction.number,
    customerId: transaction.customerId,
    customerName: transaction.customer?.name ?? null,
    status: transaction.status,
    totalAmount: Number(transaction.totalAmount),
    discountTotal: Number(transaction.discountTotal),
    createdAt: transaction.createdAt.toISOString(),
    items: transaction.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      qty: Number(item.qty),
      price: Number(item.price),
      isProductActive: item.product.isActive
    }))
  };
}

export async function voidTransaction(transactionId: string, actorId: string, actorRole: Role) {
  assertPermission(actorRole, "VOID_REFUND");
  const inventorySettings = await getInventorySettings();
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
      await reverseSaleIssue(tx, {
        productId: item.productId,
        quantity: Number(item.qty),
        unitCost: item.costAtSale,
        reason: `Void sale ${transaction.number}`,
        referenceId: transaction.id,
        referenceType: InventoryReferenceType.SALE,
        userId: actorId,
        method: inventorySettings.inventoryValuationMethod
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
  const inventorySettings = await getInventorySettings();
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
      await reverseSaleIssue(tx, {
        productId: item.productId,
        quantity: Number(item.qty),
        unitCost: item.costAtSale,
        reason: "Transaction refund",
        referenceId: transaction.id,
        referenceType: InventoryReferenceType.SALE,
        userId: actorId,
        method: inventorySettings.inventoryValuationMethod
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
          orderDiscount: op.payload.orderDiscount as DiscountInput | undefined,
          items: op.payload.items as SaleInput["items"]
        });
      } else if (op.type === PendingOpType.ADJUSTMENT) {
        assertPermission(user.role, "INVENTORY_ADJUST");
        const inventorySettings = await getInventorySettings();
        if (!inventorySettings.allowManualStockAdjustments) {
          throw new Error("Manual stock adjustments are disabled");
        }
        const productId = op.payload.productId as string;
        const qtyDelta = Number(op.payload.qtyDelta);
        const reason = String(op.payload.reason ?? "Offline adjustment");
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Product not found");
          if (!inventorySettings.allowNegativeStock && Number(product.stockQty) + qtyDelta < 0) {
            throw new Error("Insufficient stock");
          }
          await applyInventoryAdjustment(tx, {
            productId,
            quantity: qtyDelta,
            reason,
            referenceType: InventoryReferenceType.ADJUSTMENT,
            userId,
            method: inventorySettings.inventoryValuationMethod
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
        const inventorySettings = await getInventorySettings();
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
          if (!inventorySettings.allowNegativeStock && Number(source.stockQty) - sourceQty < 0) {
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
