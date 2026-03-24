import { NextRequest } from "next/server";
import { PendingOpType } from "@prisma/client";
import { pushOfflineOperations } from "@/lib/pos-service";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  const body = await request.json();
  const operations = body.operations as Array<{
    opId: string;
    type: PendingOpType;
    payload: Record<string, unknown>;
  }>;
  if (!Array.isArray(operations)) {
    return badRequest("operations array is required");
  }
  const results = await pushOfflineOperations(user.id, operations);
  return ok({ results });
}
