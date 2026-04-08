import { ExpenseStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import {
  asOptionalText,
  parseExpenseAmount,
  parseExpenseDate,
  parseExpensePaymentMethod,
  parseExpenseStatus
} from "@/lib/expense-utils";
import { prisma } from "@/lib/prisma";

function canManage(role: Role) {
  return role === Role.OWNER || role === Role.MANAGER;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }

    const { id } = await context.params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true,
        expenseNo: true,
        date: true,
        categoryId: true,
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
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    if (!expense) {
      return badRequest("Expense not found");
    }
    return ok({
      ...expense,
      date: expense.date.toISOString(),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
      cancelledAt: expense.cancelledAt?.toISOString() ?? null,
      amount: Number(expense.amount)
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to load expense");
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    if (!canManage(actor.role)) {
      return forbidden();
    }

    const { id } = await context.params;
    const current = await prisma.expense.findUnique({
      where: { id },
      select: { id: true, status: true }
    });
    if (!current) {
      return badRequest("Expense not found");
    }
    if (current.status === ExpenseStatus.CANCELLED) {
      return badRequest("Cancelled expenses cannot be edited");
    }

    const body = await request.json();
    const date = parseExpenseDate(body.date);
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const description = asOptionalText(body.description);
    const amount = parseExpenseAmount(body.amount);
    const status = parseExpenseStatus(body.status);

    if (!categoryId) {
      return badRequest("category is required");
    }
    if (!description) {
      return badRequest("description is required");
    }
    if (!status || status === ExpenseStatus.CANCELLED) {
      return badRequest("status is invalid");
    }

    const paymentMethod =
      body.paymentMethod == null || body.paymentMethod === ""
        ? null
        : parseExpensePaymentMethod(body.paymentMethod);
    if (status === ExpenseStatus.PAID && !paymentMethod) {
      return badRequest("payment method is required for paid expenses");
    }
    if (body.paymentMethod && !paymentMethod) {
      return badRequest("payment method is invalid");
    }

    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true }
    });
    if (!category || !category.isActive) {
      return badRequest("selected category is invalid");
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        date,
        categoryId,
        description,
        amount,
        paymentMethod,
        paidTo: asOptionalText(body.paidTo),
        referenceNo: asOptionalText(body.referenceNo),
        remarks: asOptionalText(body.remarks),
        status
      },
      select: {
        id: true,
        expenseNo: true
      }
    });

    return ok(expense);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to update expense");
  }
}
