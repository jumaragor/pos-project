import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const transactions = await prisma.transaction.findMany({
    where: { customerId: id },
    select: {
      id: true,
      number: true,
      totalAmount: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  return ok(
    transactions.map((transaction) => ({
      ...transaction,
      totalAmount: Number(transaction.totalAmount),
      createdAt: transaction.createdAt.toISOString()
    }))
  );
}
