import { NextRequest } from "next/server";
import { voidTransaction } from "@/lib/pos-service";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return unauthorized();
    }
    const body = await request.json();
    if (!body.transactionId) {
      return badRequest("transactionId is required");
    }
    const result = await voidTransaction(body.transactionId, user.id, user.role);
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError(error instanceof Error ? error.message : "Failed to void transaction");
  }
}
