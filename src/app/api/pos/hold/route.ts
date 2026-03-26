import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, created, serverError } from "@/lib/http";
import { saveDraftSale } from "@/lib/pos-service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "Your session is no longer valid. Please sign in again." },
        { status: 401 }
      );
    }
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest("items are required");
    }

    const transaction = await saveDraftSale({
      userId: user.id,
      customerId: body.customerId,
      paymentMethod: (body.paymentMethod as PaymentMethod) ?? PaymentMethod.CASH,
      draftId: body.draftId,
      orderDiscount: body.orderDiscount,
      items: body.items
    });

    return created(transaction);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to hold order");
  }
}
