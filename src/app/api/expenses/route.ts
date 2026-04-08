import { ExpenseStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import {
  asOptionalText,
  parseExpenseAmount,
  parseExpenseDate,
  parseExpensePaymentMethod,
  parseExpenseStatus
} from "@/lib/expense-utils";
import { createUniqueExpenseNumber, getExpensesData } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

function canManage(role: Role) {
  return role === Role.OWNER || role === Role.MANAGER;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }

    const params = request.nextUrl.searchParams;
    return ok(
      await getExpensesData({
        query: params.get("q") ?? undefined,
        categoryId: params.get("categoryId") ?? undefined,
        status: params.get("status") ?? undefined,
        paymentMethod: params.get("paymentMethod") ?? undefined,
        dateFrom: params.get("dateFrom") ?? undefined,
        dateTo: params.get("dateTo") ?? undefined,
        page: params.get("page"),
        pageSize: params.get("pageSize")
      })
    );
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to fetch expenses");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    if (!canManage(actor.role)) {
      return forbidden();
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
    if (!status) {
      return badRequest("status is required");
    }

    const paymentMethod =
      body.paymentMethod == null || body.paymentMethod === ""
        ? null
        : parseExpensePaymentMethod(body.paymentMethod);

    if (status === ExpenseStatus.PAID && !paymentMethod) {
      return badRequest("payment method is required for paid expenses");
    }
    if (status !== ExpenseStatus.PAID && paymentMethod === null) {
      // allowed
    } else if (body.paymentMethod && !paymentMethod) {
      return badRequest("payment method is invalid");
    }

    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true }
    });
    if (!category || !category.isActive) {
      return badRequest("selected category is invalid");
    }

    const expenseNo = await createUniqueExpenseNumber(date);
    const expense = await prisma.expense.create({
      data: {
        expenseNo,
        date,
        categoryId,
        description,
        amount,
        paymentMethod,
        paidTo: asOptionalText(body.paidTo),
        referenceNo: asOptionalText(body.referenceNo),
        remarks: asOptionalText(body.remarks),
        status,
        createdById: actor.id,
        cancelledAt: status === ExpenseStatus.CANCELLED ? new Date() : null,
        cancelledById: status === ExpenseStatus.CANCELLED ? actor.id : null
      },
      select: {
        id: true,
        expenseNo: true
      }
    });

    return created(expense);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create expense");
  }
}
