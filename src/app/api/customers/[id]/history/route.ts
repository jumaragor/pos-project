import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const transactions = await prisma.transaction.findMany({
    where: { customerId: id },
    include: {
      items: { include: { product: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return ok(transactions);
}
