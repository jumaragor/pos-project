import { NextRequest } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { createSale } from "@/lib/pos-service";
import { badRequest, created, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return unauthorized();
    }
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest("items are required");
    }
    const transaction = await createSale({
      userId: user.id,
      customerId: body.customerId,
      paymentMethod: body.paymentMethod as PaymentMethod,
      cashAmount: body.cashAmount,
      qrAmount: body.qrAmount,
      orderDiscount: body.orderDiscount,
      items: body.items
    });
    return created(transaction);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create transaction");
  }
}
