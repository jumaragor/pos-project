import { forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { listSales } from "@/lib/sales";
import { parsePositiveInt } from "@/lib/pagination";

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
  const page = parsePositiveInt(searchParams.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 25, 100);
  const { items, pagination } = await listSales({ dateFrom, dateTo, page, pageSize });

  return ok({ items, pagination });
}
