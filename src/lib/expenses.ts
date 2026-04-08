import { ExpensePaymentMethod, ExpenseStatus, Prisma } from "@prisma/client";
import { buildPagination, DEFAULT_PAGE_SIZE, parsePositiveInt } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ensureDefaultExpenseCategories, generateExpenseNumber } from "@/lib/expense-utils";

export type ExpenseFilters = {
  query?: string;
  categoryId?: string;
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string | null;
  pageSize?: string | null;
};

export function buildExpenseWhere(filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const query = filters.query?.trim();
  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();
  const dateWhere =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
          ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {})
        }
      : undefined;

  return {
    ...(query
      ? {
          OR: [
            { expenseNo: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { paidTo: { contains: query, mode: "insensitive" } },
            { referenceNo: { contains: query, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status && filters.status !== "ALL"
      ? { status: filters.status as ExpenseStatus }
      : {}),
    ...(filters.paymentMethod && filters.paymentMethod !== "ALL"
      ? { paymentMethod: filters.paymentMethod as ExpensePaymentMethod }
      : {}),
    ...(dateWhere ? { date: dateWhere } : {})
  };
}

export async function getExpensesData(filters: ExpenseFilters = {}) {
  await ensureDefaultExpenseCategories(prisma);

  const where = buildExpenseWhere(filters);
  const pageSize = parsePositiveInt(filters.pageSize ?? null, DEFAULT_PAGE_SIZE);
  const requestedPage = parsePositiveInt(filters.page ?? null, 1, 10_000);

  const [total, expenses, grandTotalAgg, paidAgg, pendingAgg, cancelledAgg] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        expenseNo: true,
        date: true,
        description: true,
        amount: true,
        paymentMethod: true,
        paidTo: true,
        referenceNo: true,
        remarks: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        cancelledAt: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }),
    prisma.expense.aggregate({
      where: {
        ...where,
        status: { not: ExpenseStatus.CANCELLED }
      },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: {
        ...where,
        status: ExpenseStatus.PAID
      },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: {
        ...where,
        status: ExpenseStatus.PENDING
      },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: {
        ...where,
        status: ExpenseStatus.CANCELLED
      },
      _sum: { amount: true }
    })
  ]);

  return {
    items: expenses.map((expense) => ({
      ...expense,
      date: expense.date.toISOString(),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
      cancelledAt: expense.cancelledAt?.toISOString() ?? null,
      amount: Number(expense.amount)
    })),
    pagination: buildPagination(requestedPage, pageSize, total),
    summary: {
      totalExpenses: Number(grandTotalAgg._sum.amount ?? 0),
      paidExpenses: Number(paidAgg._sum.amount ?? 0),
      pendingExpenses: Number(pendingAgg._sum.amount ?? 0),
      cancelledExpenses: Number(cancelledAgg._sum.amount ?? 0)
    }
  };
}

export async function getExpenseCategories(activeOnly = false) {
  await ensureDefaultExpenseCategories(prisma);
  const categories = await prisma.expenseCategory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true
    }
  });
  return categories;
}

export async function createUniqueExpenseNumber(date: Date) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const expenseNo = await generateExpenseNumber(prisma, date);
    const exists = await prisma.expense.findUnique({
      where: { expenseNo },
      select: { id: true }
    });
    if (!exists) return expenseNo;
  }
  throw new Error("Failed to generate unique expense number");
}
