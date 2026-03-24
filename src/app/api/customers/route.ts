import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, created, ok } from "@/lib/http";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" }
  });
  return ok(customers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.name || !body.mobile) {
    return badRequest("name and mobile are required");
  }
  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      mobile: body.mobile
    }
  });
  return created(customer);
}
