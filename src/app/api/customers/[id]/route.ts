import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, serverError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const customer = await prisma.customer.update({
      where: { id },
      data: { name: body.name, mobile: body.mobile }
    });
    return ok(customer);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to update customer");
  }
}
