import { NextRequest } from "next/server";
import { repackStock } from "@/lib/inventory-service";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return unauthorized();
    }
    const body = await request.json();
    if (!body.sourceProductId || !body.targetProductId || !body.sourceQty || !body.factor) {
      return badRequest("sourceProductId, targetProductId, sourceQty, factor are required");
    }
    const result = await repackStock({
      sourceProductId: body.sourceProductId,
      targetProductId: body.targetProductId,
      sourceQty: Number(body.sourceQty),
      factor: Number(body.factor),
      reason: body.reason,
      userId: user.id,
      role: user.role
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError(error instanceof Error ? error.message : "Failed to repack");
  }
}
