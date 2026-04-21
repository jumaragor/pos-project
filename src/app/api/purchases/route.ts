import { InventoryReferenceType, PurchaseStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";
import { getInventorySettings } from "@/lib/inventory-settings";
import { applyPurchaseReceipt } from "@/lib/inventory-valuation";
import { buildPagination, DEFAULT_PAGE_SIZE, parsePositiveInt } from "@/lib/pagination";
import { PURCHASE_VOID_MARKER } from "@/lib/purchase-utils";
import { prisma } from "@/lib/prisma";

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
  return PurchaseStatus.POSTED;
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

async function generatePurchaseNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `PUR-${yyyy}${mm}${dd}`;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const countToday = await prisma.purchase.count({
    where: { createdAt: { gte: todayStart, lt: todayEnd } }
  });
  return `${prefix}-${String(countToday + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const supplierId = request.nextUrl.searchParams.get("supplierId")?.trim();
    const status = request.nextUrl.searchParams.get("status")?.trim();
    const dateFrom = request.nextUrl.searchParams.get("dateFrom")?.trim();
    const dateTo = request.nextUrl.searchParams.get("dateTo")?.trim();
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
    const purchaseDateWhere =
      dateFrom || dateTo
        ? {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {})
          }
        : undefined;
    const where = {
      ...(query
        ? {
            OR: [
              { purchaseNumber: { contains: query, mode: "insensitive" as const } },
              { supplierName: { contains: query, mode: "insensitive" as const } },
              { referenceNumber: { contains: query, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(purchaseDateWhere ? { purchaseDate: purchaseDateWhere } : {}),
      ...(status === "VOIDED"
        ? { notes: { contains: PURCHASE_VOID_MARKER } }
        : status === "DRAFT"
          ? { status: PurchaseStatus.DRAFT, NOT: { notes: { contains: PURCHASE_VOID_MARKER } } }
          : status === "POSTED"
            ? { status: PurchaseStatus.POSTED, NOT: { notes: { contains: PURCHASE_VOID_MARKER } } }
            : {})
    };
    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
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
          status: true
        },
        orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize
      })
    ]);
    return ok({
      items: purchases.map((purchase) => ({
        ...purchase,
        purchaseDate: purchase.purchaseDate.toISOString(),
        totalItems: Number(purchase.totalItems),
        totalCost: Number(purchase.totalCost)
      })),
      pagination: buildPagination(requestedPage, pageSize, total)
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to fetch purchases");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }

    const body = await request.json();
    const inventorySettings = await getInventorySettings();
    const status = toStatus(body.status);
    const purchaseDate = parsePurchaseDate(body.purchaseDate);
    const items = parseItems(body.items);
    const supplierId = typeof body.supplierId === "string" && body.supplierId.trim() ? body.supplierId : null;
    const supplierName = asOptionalText(body.supplierName);
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
      if (supplier.status !== "ACTIVE") {
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
    const purchaseNumber = await generatePurchaseNumber();
    const referenceNumber = purchaseNumber;

    const purchase = await prisma.$transaction(async (tx) => {
      const createdPurchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          purchaseDate,
          supplierId,
          supplierName: resolvedSupplierName,
          referenceNumber,
          notes,
          totalItems,
          totalCost,
          status,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitCost: item.unitCost,
              amount: item.amount,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal
            }))
          }
        },
        include: { items: true }
      });

      if (status === PurchaseStatus.POSTED) {
        for (const item of normalizedItems) {
          await applyPurchaseReceipt(tx, {
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            reason: `Purchase ${purchaseNumber}`,
            referenceId: createdPurchase.id,
            referenceType: InventoryReferenceType.PURCHASE,
            userId: actor.id,
            method: inventorySettings.inventoryValuationMethod
          });
        }
      }

      return createdPurchase;
    });

    return created(purchase);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create purchase");
  }
}
