import { TransactionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, created, ok } from "@/lib/http";
import { buildPagination, DEFAULT_PAGE_SIZE, parsePositiveInt } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { mobile: { contains: query, mode: "insensitive" as const } }
        ]
      }
    : undefined;
  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        mobile: true
      }
    })
  ]);
  const grouped = customers.length
    ? await prisma.transaction.groupBy({
        by: ["customerId"],
        where: {
          customerId: {
            in: customers.map((customer) => customer.id)
          },
          status: TransactionStatus.COMPLETED
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
        _max: { createdAt: true }
      })
    : [];
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

  return ok({
    items: customers.map((customer) => ({
      ...customer,
      ...metricsByCustomerId.get(customer.id),
      totalPurchases: metricsByCustomerId.get(customer.id)?.totalPurchases ?? 0,
      totalVisits: metricsByCustomerId.get(customer.id)?.totalVisits ?? 0,
      lastVisit: metricsByCustomerId.get(customer.id)?.lastVisit ?? null
    })),
    pagination: buildPagination(requestedPage, pageSize, total)
  });
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
