import { NextRequest } from "next/server";
import { adjustStock } from "@/lib/inventory-service";
import { badRequest, forbidden, created, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return unauthorized();
    }
    const body = await request.json();
    if (!body.productId || typeof body.qtyDelta !== "number" || !body.reason) {
      return badRequest("productId, qtyDelta, and reason are required");
    }
    const move = await adjustStock({
      productId: body.productId,
      qtyDelta: body.qtyDelta,
      reason: body.reason,
      userId: user.id,
      role: user.role
    });
    return created(move);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError(error instanceof Error ? error.message : "Failed to adjust stock");
  }
}
