import { NextRequest } from "next/server";
import { stockInProduct } from "@/lib/inventory-service";
import { badRequest, created, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return unauthorized();
    }
    const body = await request.json();
    if (!body.productId || !body.qty) {
      return badRequest("productId and qty are required");
    }
    const move = await stockInProduct({
      productId: body.productId,
      qty: Number(body.qty),
      reason: body.reason,
      userId: user.id
    });
    return created(move);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to stock in");
  }
}
