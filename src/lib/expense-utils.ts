import { ExpensePaymentMethod, ExpenseStatus, PrismaClient } from "@prisma/client";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Internet",
  "Salaries/Wages",
  "Transportation",
  "Repairs & Maintenance",
  "Office Supplies",
  "Permits & Licenses",
  "Taxes & Government Fees",
  "Meals / Pantry",
  "Miscellaneous"
];

export function asOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseExpenseStatus(value: unknown) {
  return value === ExpenseStatus.PAID || value === ExpenseStatus.PENDING || value === ExpenseStatus.CANCELLED
    ? value
    : null;
}

export function parseExpensePaymentMethod(value: unknown) {
  return value === ExpensePaymentMethod.CASH ||
    value === ExpensePaymentMethod.GCASH ||
    value === ExpensePaymentMethod.CARD ||
    value === ExpensePaymentMethod.BANK_TRANSFER ||
    value === ExpensePaymentMethod.OTHERS
    ? value
    : null;
}

export function parseExpenseDate(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("date is required");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("date is invalid");
  }
  return date;
}

export function parseExpenseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be greater than 0");
  }
  return Number(amount.toFixed(2));
}

export async function ensureDefaultExpenseCategories(prisma: PrismaClient) {
  const count = await prisma.expenseCategory.count();
  if (count > 0) return;
  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      name,
      isActive: true
    })),
    skipDuplicates: true
  });
}

export async function generateExpenseNumber(prisma: PrismaClient, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `EXP-${year}-`;
  const latest = await prisma.expense.findFirst({
    where: {
      expenseNo: {
        startsWith: prefix
      }
    },
    orderBy: {
      expenseNo: "desc"
    },
    select: { expenseNo: true }
  });
  const currentSequence = latest?.expenseNo ? Number(latest.expenseNo.slice(prefix.length)) : 0;
  const nextSequence = Number.isFinite(currentSequence) ? currentSequence + 1 : 1;
  return `${prefix}${String(nextSequence).padStart(6, "0")}`;
}
