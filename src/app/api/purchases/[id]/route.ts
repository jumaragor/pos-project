import { PurchaseStatus, StockMovementType } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
};

function asOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toStatus(value: unknown) {
  if (value === PurchaseStatus.DRAFT || value === PurchaseStatus.POSTED) {
    return value;
  }
  return PurchaseStatus.DRAFT;
}

function parseItems(value: unknown): PurchaseItemInput[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("At least one purchase item is required");
  }
  const items = value.map((item) => ({
    productId: typeof item?.productId === "string" ? item.productId : "",
    quantity: Number(item?.quantity),
    unitCost: Number(item?.unitCost),
    taxRate: Number(item?.taxRate ?? 0)
  }));
  if (items.some((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    throw new Error("Each purchase item must have a product and quantity greater than 0");
  }
  if (items.some((item) => !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
    throw new Error("Each purchase item must have unit cost 0 or greater");
  }
  if (items.some((item) => !Number.isFinite(item.taxRate) || item.taxRate < 0)) {
    throw new Error("Each purchase item must have tax rate 0 or greater");
  }
  return items;
}

function parsePurchaseDate(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("purchaseDate is required");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("purchaseDate is invalid");
  }
  return date;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        supplierId: true,
        supplierName: true,
        referenceNumber: true,
        notes: true,
        totalItems: true,
        totalCost: true,
        status: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            productId: true,
            productName: true,
            quantity: true,
            unitCost: true,
            amount: true,
            taxRate: true,
            taxAmount: true,
            lineTotal: true
          }
        }
      }
    });
    if (!purchase) {
      return badRequest("Purchase not found");
    }
    return ok({
      ...purchase,
      purchaseDate: purchase.purchaseDate.toISOString(),
      totalItems: Number(purchase.totalItems),
      totalCost: Number(purchase.totalCost),
      items: purchase.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        amount: Number(item.amount),
        taxRate: Number(item.taxRate),
        taxAmount: Number(item.taxAmount),
        lineTotal: Number(item.lineTotal)
      }))
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to fetch purchase");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }

    const { id } = await params;
    const existing = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) {
      return badRequest("Purchase not found");
    }
    if (isVoidedPurchaseNote(existing.notes)) {
      return badRequest("Voided purchases can no longer be edited");
    }
    if (existing.status === PurchaseStatus.POSTED) {
      return badRequest("Posted purchases can no longer be edited");
    }

    const body = await request.json();
    const status = toStatus(body.status);
    const purchaseDate = parsePurchaseDate(body.purchaseDate);
    const items = parseItems(body.items);
    const supplierId = typeof body.supplierId === "string" && body.supplierId.trim() ? body.supplierId : null;
    const supplierName = asOptionalText(body.supplierName);
    const referenceNumber = asOptionalText(body.referenceNumber);
    const notes = asOptionalText(body.notes);
    let resolvedSupplierName = supplierName;

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { supplierName: true, status: true }
      });
      if (!supplier) {
        return badRequest("Selected supplier does not exist");
      }
      if (supplier.status !== "ACTIVE" && existing.supplierId !== supplierId) {
        return badRequest("Inactive suppliers cannot be used for new purchases");
      }
      resolvedSupplierName = supplier.supplierName;
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });
    if (products.length !== productIds.length) {
      return badRequest("One or more selected products do not exist");
    }
    const productById = new Map(products.map((product) => [product.id, product]));
    const normalizedItems = items.map((item) => ({
      ...item,
      amount: Number((item.quantity * item.unitCost).toFixed(2)),
      taxAmount: Number((item.quantity * item.unitCost * (item.taxRate / 100)).toFixed(2)),
      lineTotal: Number((item.quantity * item.unitCost * (1 + item.taxRate / 100)).toFixed(2)),
      productName: productById.get(item.productId)?.name ?? "Unknown Product"
    }));
    const totalItems = normalizedItems.length;
    const totalCost = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);

    const updated = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: { id },
        data: {
          purchaseDate,
          supplierId,
          supplierName: resolvedSupplierName,
          referenceNumber,
          notes,
          totalItems,
          totalCost,
          status
        }
      });

      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseItem.createMany({
        data: normalizedItems.map((item) => ({
          purchaseId: id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          amount: item.amount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal
        }))
      });

      if (status === PurchaseStatus.POSTED) {
        for (const item of normalizedItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } }
          });
          await tx.stockMovement.create({
            data: {
              type: StockMovementType.STOCK_IN,
              productId: item.productId,
              qtyDelta: item.quantity,
              reason: `Purchase ${existing.purchaseNumber}`,
              refId: purchase.id,
              userId: actor.id
            }
          });
        }
      }

      return tx.purchase.findUnique({
        where: { id },
        include: { items: { orderBy: { id: "asc" } } }
      });
    });

    return ok(updated);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to update purchase");
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const { id } = await params;
    const existing = await prisma.purchase.findUnique({ where: { id } });
    if (!existing) {
      return badRequest("Purchase not found");
    }
    if (isVoidedPurchaseNote(existing.notes)) {
      return badRequest("Voided purchases cannot be deleted");
    }
    if (existing.status !== PurchaseStatus.DRAFT) {
      return badRequest("Only draft purchases can be deleted");
    }
    await prisma.purchase.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to delete purchase");
  }
}
