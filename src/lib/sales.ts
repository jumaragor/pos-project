import { PaymentMethod, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildUomLookup } from "@/lib/uom-lookup";

export type SalesFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type SalesListRow = {
  id: string;
  number: string;
  createdAt: string;
  cashierName: string;
  status: TransactionStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentAmount: number | null;
  changeAmount: number | null;
  paymentMethod: PaymentMethod;
};

export type SalesDetail = SalesListRow & {
  customerName: string | null;
  cashierUsername: string | null;
  cashAmount: number | null;
  qrAmount: number | null;
  items: Array<{
    productId: string;
    name: string;
    sku: string | null;
    uom: string | null;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

function buildSalesWhere(filters: SalesFilters) {
  const createdAt: { gte?: Date; lte?: Date } = {};

  if (filters.dateFrom) {
    createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000`);
  }
  if (filters.dateTo) {
    createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return {
    status: { in: [TransactionStatus.COMPLETED, TransactionStatus.VOID, TransactionStatus.REFUNDED] },
    ...(Object.keys(createdAt).length ? { createdAt } : {})
  };
}

function toPaymentAmount(cashAmount: number | null, qrAmount: number | null) {
  if (cashAmount == null && qrAmount == null) return null;
  return Number(cashAmount ?? 0) + Number(qrAmount ?? 0);
}

function toChangeAmount(paymentAmount: number | null, total: number) {
  if (paymentAmount == null) return null;
  return Math.max(paymentAmount - total, 0);
}

export async function listSales(filters: SalesFilters = {}) {
  const transactions = await prisma.transaction.findMany({
    where: buildSalesWhere(filters),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      createdAt: true,
      status: true,
      discountTotal: true,
      totalAmount: true,
      cashAmount: true,
      qrAmount: true,
      paymentMethod: true,
      user: { select: { name: true } }
    }
  });

  return transactions.map((transaction) => {
    const discount = Number(transaction.discountTotal);
    const tax = 0;
    const total = Number(transaction.totalAmount);
    const subtotal = total + discount;
    const paymentAmount = toPaymentAmount(
      transaction.cashAmount == null ? null : Number(transaction.cashAmount),
      transaction.qrAmount == null ? null : Number(transaction.qrAmount)
    );

    return {
      id: transaction.id,
      number: transaction.number,
      createdAt: transaction.createdAt.toISOString(),
      cashierName: transaction.user.name,
      status: transaction.status,
      subtotal,
      discount,
      tax,
      total,
      paymentAmount,
      changeAmount: toChangeAmount(paymentAmount, total),
      paymentMethod: transaction.paymentMethod
    } satisfies SalesListRow;
  });
}

export async function getSaleDetail(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      user: { select: { name: true, username: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              uomId: true
            }
          }
        }
      }
    }
  });

  if (!transaction || transaction.status === TransactionStatus.DRAFT) {
    return null;
  }

  const uomLookup = await buildUomLookup(transaction.items.map((item) => item.product.uomId));
  const subtotal = transaction.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const discount = Number(transaction.discountTotal);
  const tax = 0;
  const total = Number(transaction.totalAmount);
  const cashAmount = transaction.cashAmount == null ? null : Number(transaction.cashAmount);
  const qrAmount = transaction.qrAmount == null ? null : Number(transaction.qrAmount);
  const paymentAmount = toPaymentAmount(cashAmount, qrAmount);

  return {
    id: transaction.id,
    number: transaction.number,
    createdAt: transaction.createdAt.toISOString(),
    cashierName: transaction.user.name,
    cashierUsername: transaction.user.username ?? null,
    customerName: transaction.customer?.name ?? null,
    status: transaction.status,
    subtotal,
    discount,
    tax,
    total,
    paymentAmount,
    changeAmount: toChangeAmount(paymentAmount, total),
    paymentMethod: transaction.paymentMethod,
    cashAmount,
    qrAmount,
    items: transaction.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      sku: item.product.sku ?? null,
      uom: uomLookup.get(item.product.uomId ?? "")?.code ?? item.product.unit ?? null,
      qty: Number(item.qty),
      unitPrice: Number(item.price),
      lineTotal: Number(item.subtotal)
    }))
  } satisfies SalesDetail;
}
