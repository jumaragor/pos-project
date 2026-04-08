import { ExpenseStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

function canManage(role: Role) {
  return role === Role.OWNER || role === Role.MANAGER;
}

export async function POST(
  _request: NextRequest,
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
      return badRequest("Expense is already cancelled");
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: actor.id
      },
      select: {
        id: true,
        expenseNo: true
      }
    });

    return ok(expense);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to cancel expense");
  }
}
