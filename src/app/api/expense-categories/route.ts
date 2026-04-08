import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { ok, unauthorized } from "@/lib/http";
import { getExpenseCategories } from "@/lib/expenses";

export async function GET(request: NextRequest) {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }

  const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
  return ok({
    items: await getExpenseCategories(activeOnly)
  });
}
