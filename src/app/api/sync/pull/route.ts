import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  const sinceRaw = request.nextUrl.searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : new Date(0);
  const products = await prisma.product.findMany({
    where: { updatedAt: { gt: since } },
    orderBy: { updatedAt: "asc" }
  });
  return ok({
    products,
    serverTime: new Date().toISOString()
  });
}
