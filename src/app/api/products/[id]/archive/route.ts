import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const { id } = await params;
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });
    return ok(product);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to archive product");
  }
}
