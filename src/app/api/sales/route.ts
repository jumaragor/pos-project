import { forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { listSales } from "@/lib/sales";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const items = await listSales({ dateFrom, dateTo });

  return ok({ items });
}
