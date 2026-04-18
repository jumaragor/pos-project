import { forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { getSaleDetail } from "@/lib/sales";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return forbidden();
  }

  const { id } = await params;
  const sale = await getSaleDetail(id);
  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  return ok(sale);
}
