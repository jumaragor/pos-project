import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getHeldTransaction } from "@/lib/pos-service";
import { prisma } from "@/lib/prisma";
import { ok, serverError, unauthorized } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return unauthorized();
    }
    const { id } = await params;
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, isActive: true } }
          }
        }
      }
    });
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    if (transaction.status === "DRAFT") {
      const heldTransaction = await getHeldTransaction(id);
      return ok(heldTransaction);
    }
    return ok({
      id: transaction.id,
      number: transaction.number,
      customerId: transaction.customerId,
      customerName: transaction.customer?.name ?? null,
      cashierName: transaction.user.name,
      cashierUsername: transaction.user.username,
      status: transaction.status,
      totalAmount: Number(transaction.totalAmount),
      discountTotal: Number(transaction.discountTotal),
      taxAmount: 0,
      paymentMethod: transaction.paymentMethod,
      cashAmount: transaction.cashAmount == null ? null : Number(transaction.cashAmount),
      qrAmount: transaction.qrAmount == null ? null : Number(transaction.qrAmount),
      createdAt: transaction.createdAt.toISOString(),
      items: transaction.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        qty: Number(item.qty),
        price: Number(item.price),
        lineTotal: Number(item.subtotal),
        isProductActive: item.product.isActive
      }))
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to load held order");
  }
}
