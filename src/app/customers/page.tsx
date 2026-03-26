import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CustomersScreen } from "@/components/customers-screen";
import { buildPagination, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, total, grouped] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: DEFAULT_PAGE_SIZE,
      select: { id: true, name: true, mobile: true }
    }),
    prisma.customer.count(),
    prisma.transaction.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null }, status: TransactionStatus.COMPLETED },
      _sum: { totalAmount: true },
      _count: { _all: true },
      _max: { createdAt: true }
    })
  ]);
  const metricsByCustomerId = new Map(
    grouped
      .filter((item) => item.customerId)
      .map((item) => [
        item.customerId as string,
        {
          totalPurchases: Number(item._sum.totalAmount ?? 0),
          totalVisits: item._count._all,
          lastVisit: item._max.createdAt?.toISOString() ?? null
        }
      ])
  );
  return (
    <div className="grid">
      <CustomersScreen
        initialCustomers={customers.map((customer) => ({
          ...customer,
          totalPurchases: metricsByCustomerId.get(customer.id)?.totalPurchases ?? 0,
          totalVisits: metricsByCustomerId.get(customer.id)?.totalVisits ?? 0,
          lastVisit: metricsByCustomerId.get(customer.id)?.lastVisit ?? null
        }))}
        initialPagination={buildPagination(1, DEFAULT_PAGE_SIZE, total)}
      />
    </div>
  );
}
