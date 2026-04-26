import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { listPosCatalog } from "@/lib/pos-catalog";
import { parsePositiveInt } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 50, 500);
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const category = request.nextUrl.searchParams.get("category")?.trim() ?? "All";

  const payload = await listPosCatalog({
    page,
    pageSize,
    query,
    category
  });

  return ok(payload);
}
