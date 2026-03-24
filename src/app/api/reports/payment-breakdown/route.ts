import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";

export async function GET() {
  const data = await prisma.transaction.groupBy({
    by: ["paymentMethod"],
    _sum: { totalAmount: true },
    where: { status: TransactionStatus.COMPLETED }
  });
  return ok(data);
}
