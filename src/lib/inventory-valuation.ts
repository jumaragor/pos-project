import { InventoryReferenceType, Prisma, StockMovementType } from "@prisma/client";

export type InventoryValuationMethodSetting = "STANDARD" | "FIFO";

type Tx = Prisma.TransactionClient;

type MovementParams = {
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  unitCost?: Prisma.Decimal | number | null;
  reason?: string | null;
  referenceId?: string | null;
  referenceType?: InventoryReferenceType | null;
  userId: string;
};

type StockOperationParams = {
  productId: string;
  quantity: number;
  unitCost?: number | Prisma.Decimal;
  reason?: string;
  referenceId?: string;
  referenceType?: InventoryReferenceType;
  userId: string;
  method: InventoryValuationMethodSetting;
};

function decimal(value: Prisma.Decimal | number | string) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal | number) {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

function roundCurrency(value: Prisma.Decimal | number) {
  return decimal(value).toDecimalPlaces(2);
}

async function getProductOrThrow(tx: Tx, productId: string) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      unitCost: true,
      stockQty: true
    }
  });
  if (!product) {
    throw new Error("Product not found");
  }
  return product;
}

export async function createInventoryMovement(tx: Tx, params: MovementParams) {
  await tx.stockMovement.create({
    data: {
      type: params.type,
      productId: params.productId,
      qtyDelta: params.quantityChange,
      unitCost: params.unitCost == null ? null : roundCurrency(params.unitCost),
      reason: params.reason ?? null,
      refId: params.referenceId ?? null,
      referenceType: params.referenceType ?? null,
      userId: params.userId
    }
  });
}

async function createFifoLayer(
  tx: Tx,
  params: {
    productId: string;
    quantity: number;
    unitCost: Prisma.Decimal | number;
    referenceId?: string;
    referenceType?: InventoryReferenceType;
  }
) {
  if (params.quantity <= 0) return;
  await tx.inventoryLayer.create({
    data: {
      productId: params.productId,
      remainingQty: params.quantity,
      unitCost: roundCurrency(params.unitCost),
      referenceId: params.referenceId ?? null,
      referenceType: params.referenceType ?? null
    }
  });
}

async function consumeFifoLayers(
  tx: Tx,
  params: {
    productId: string;
    quantity: number;
    fallbackUnitCost: Prisma.Decimal | number;
  }
) {
  let remaining = params.quantity;
  let totalCost = new Prisma.Decimal(0);
  const layers = await tx.inventoryLayer.findMany({
    where: {
      productId: params.productId,
      remainingQty: { gt: 0 }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  for (const layer of layers) {
    if (remaining <= 0) break;
    const available = Number(layer.remainingQty);
    const consumed = Math.min(remaining, available);
    if (consumed <= 0) continue;
    remaining -= consumed;
    totalCost = totalCost.plus(layer.unitCost.mul(consumed));
    const nextQty = Number(layer.remainingQty) - consumed;
    await tx.inventoryLayer.update({
      where: { id: layer.id },
      data: { remainingQty: nextQty }
    });
  }

  if (remaining > 0) {
    totalCost = totalCost.plus(decimal(params.fallbackUnitCost).mul(remaining));
  }

  const effectiveUnitCost =
    params.quantity > 0 ? totalCost.div(params.quantity).toDecimalPlaces(2) : roundCurrency(params.fallbackUnitCost);

  return {
    unitCost: effectiveUnitCost,
    shortageQty: remaining
  };
}

export async function applyPurchaseReceipt(tx: Tx, params: StockOperationParams) {
  const purchaseUnitCost = roundCurrency(params.unitCost ?? 0);
  await tx.product.update({
    where: { id: params.productId },
    data: {
      stockQty: { increment: params.quantity },
      unitCost: purchaseUnitCost.toNumber(),
      costPrice: purchaseUnitCost
    }
  });
  await createInventoryMovement(tx, {
    productId: params.productId,
    type: StockMovementType.STOCK_IN,
    quantityChange: params.quantity,
    unitCost: purchaseUnitCost,
    reason: params.reason,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    userId: params.userId
  });
  if (params.method === "FIFO") {
    await createFifoLayer(tx, {
      productId: params.productId,
      quantity: params.quantity,
      unitCost: purchaseUnitCost,
      referenceId: params.referenceId,
      referenceType: params.referenceType
    });
  }
  return purchaseUnitCost;
}

export async function applySaleIssue(tx: Tx, params: StockOperationParams) {
  const product = await getProductOrThrow(tx, params.productId);
  const fallbackUnitCost = roundCurrency(product.unitCost);
  const resolvedUnitCost =
    params.method === "FIFO"
      ? (await consumeFifoLayers(tx, {
          productId: params.productId,
          quantity: params.quantity,
          fallbackUnitCost
        })).unitCost
      : fallbackUnitCost;

  await tx.product.update({
    where: { id: params.productId },
    data: { stockQty: { decrement: params.quantity } }
  });
  await createInventoryMovement(tx, {
    productId: params.productId,
    type: StockMovementType.SALE,
    quantityChange: -params.quantity,
    unitCost: resolvedUnitCost,
    reason: params.reason,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    userId: params.userId
  });
  return resolvedUnitCost;
}

export async function reverseSaleIssue(tx: Tx, params: StockOperationParams) {
  const resolvedUnitCost = roundCurrency(params.unitCost ?? 0);
  await tx.product.update({
    where: { id: params.productId },
    data: { stockQty: { increment: params.quantity } }
  });
  await createInventoryMovement(tx, {
    productId: params.productId,
    type: StockMovementType.REFUND,
    quantityChange: params.quantity,
    unitCost: resolvedUnitCost,
    reason: params.reason,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    userId: params.userId
  });
  if (params.method === "FIFO") {
    await createFifoLayer(tx, {
      productId: params.productId,
      quantity: params.quantity,
      unitCost: resolvedUnitCost,
      referenceId: params.referenceId,
      referenceType: params.referenceType
    });
  }
  return resolvedUnitCost;
}

export async function applyInventoryAdjustment(tx: Tx, params: StockOperationParams) {
  const product = await getProductOrThrow(tx, params.productId);
  const fallbackUnitCost = roundCurrency(params.unitCost ?? product.unitCost);
  let resolvedUnitCost = fallbackUnitCost;

  if (params.quantity >= 0) {
    await tx.product.update({
      where: { id: params.productId },
      data: { stockQty: { increment: params.quantity } }
    });
    if (params.method === "FIFO") {
      await createFifoLayer(tx, {
        productId: params.productId,
        quantity: params.quantity,
        unitCost: fallbackUnitCost,
        referenceId: params.referenceId,
        referenceType: params.referenceType
      });
    }
  } else {
    const absoluteQty = Math.abs(params.quantity);
    resolvedUnitCost =
      params.method === "FIFO"
        ? (await consumeFifoLayers(tx, {
            productId: params.productId,
            quantity: absoluteQty,
            fallbackUnitCost
          })).unitCost
        : fallbackUnitCost;
    await tx.product.update({
      where: { id: params.productId },
      data: { stockQty: { decrement: absoluteQty } }
    });
  }

  await createInventoryMovement(tx, {
    productId: params.productId,
    type: StockMovementType.ADJUSTMENT,
    quantityChange: params.quantity,
    unitCost: resolvedUnitCost,
    reason: params.reason,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    userId: params.userId
  });

  return resolvedUnitCost;
}

export async function getCurrentStandardUnitCost(tx: Tx, productId: string) {
  const product = await getProductOrThrow(tx, productId);
  return roundCurrency(product.unitCost);
}

export function toUnitCostNumber(value: Prisma.Decimal | number) {
  return decimalToNumber(roundCurrency(value));
}
