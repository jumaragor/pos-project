import { PaymentMethod, StockMovementType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getInventorySettings } from "@/lib/inventory-settings";
import { startPerfTimer } from "@/lib/perf";

type TrendDirection = "up" | "down" | "neutral";

type KpiMetric = {
  value: number;
  comparison: string;
  trend: TrendDirection;
};

type SalesTrendPoint = {
  label: string;
  value: number;
};

type SalesTrendPeriod = "today" | "last7" | "last30";

type PaymentBreakdownItem = {
  key: "cash" | "gcash" | "card" | "others";
  label: string;
  amount: number;
  count: number;
};

type TopProductItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  sales: number;
  contributionPct: number;
};

type InventoryHealthMetric = {
  label: string;
  value: number;
  tone: "danger" | "warning" | "success" | "neutral";
  href: string;
};

type AlertItem = {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info";
  href?: string;
};

type ActivityItem = {
  id: string;
  type: "sale" | "purchase" | "adjustment";
  label: string;
  reference: string;
  timestamp: string;
  href?: string;
};

type InsightItem = {
  id: string;
  text: string;
  tone: "success" | "warning" | "info";
};

type ActionRequiredItem = {
  type: "negative" | "out" | "low" | "no-sales" | "pending";
  count: number;
  severity: "high" | "medium" | "low";
  message: string;
  href: string;
};

export type DashboardData = {
  kpis: {
    todaySales: KpiMetric;
    todayProfit: KpiMetric;
    transactionsToday: KpiMetric;
    cashOnHand: KpiMetric;
  };
  salesTrend: Record<SalesTrendPeriod, SalesTrendPoint[]>;
  inventoryHealth: {
    metrics: InventoryHealthMetric[];
    lowStockAlertsEnabled: boolean;
    lowStockAlerts: Array<{
      id: string;
      name: string;
      sku: string;
      stock: number;
      threshold: number;
    }>;
  };
  paymentBreakdown: PaymentBreakdownItem[];
  topProducts: TopProductItem[];
  actionRequired: ActionRequiredItem[];
  alerts: AlertItem[];
  recentActivity: ActivityItem[];
  inventoryValue: {
    costValue: number;
    sellingValue: number;
  };
  insights: InsightItem[];
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function buildComparison(current: number, previous: number): KpiMetric {
  if (previous === 0 && current === 0) {
    return {
      value: current,
      comparison: "No change vs yesterday",
      trend: "neutral"
    };
  }

  if (previous === 0) {
    return {
      value: current,
      comparison: "No yesterday baseline",
      trend: current > 0 ? "up" : "neutral"
    };
  }

  const changePct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(changePct).toFixed(1);

  if (Math.abs(changePct) < 0.05) {
    return {
      value: current,
      comparison: "Flat vs yesterday",
      trend: "neutral"
    };
  }

  return {
    value: current,
    comparison: `${changePct > 0 ? "+" : "-"}${rounded}% vs yesterday`,
    trend: changePct > 0 ? "up" : "down"
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const timer = startPerfTimer("dashboard.getDashboardData");
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const yesterdayStart = startOfDay(addDays(now, -1));
  const last30Start = startOfDay(addDays(now, -29));

  const [
    todayTransactions,
    yesterdayTransactions,
    profitItems2d,
    products,
    topProductAggregates,
    recentPurchases,
    recentSales,
    recentAdjustments,
    inventorySettings
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        status: TransactionStatus.COMPLETED,
        createdAt: { gte: todayStart, lt: tomorrowStart }
      },
      select: {
        totalAmount: true,
        paymentMethod: true,
        cashAmount: true,
        qrAmount: true
      }
    }),
    prisma.transaction.findMany({
      where: {
        status: TransactionStatus.COMPLETED,
        createdAt: { gte: yesterdayStart, lt: todayStart }
      },
      select: {
        totalAmount: true,
        paymentMethod: true,
        cashAmount: true,
        qrAmount: true
      }
    }),
    prisma.transactionItem.findMany({
      where: {
        transaction: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: yesterdayStart, lt: tomorrowStart }
        }
      },
      select: {
        qty: true,
        subtotal: true,
        costAtSale: true,
        transaction: { select: { createdAt: true } }
      }
    }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        unitCost: true,
        sellingPrice: true
      }
    }),
    prisma.transactionItem.groupBy({
      by: ["productId"],
      where: {
        transaction: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: last30Start, lt: tomorrowStart }
        }
      },
      _sum: {
        qty: true,
        subtotal: true
      },
      orderBy: {
        _sum: {
          subtotal: "desc"
        }
      },
      take: 6
    }),
    prisma.purchase.findMany({
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        status: true
      },
      orderBy: { purchaseDate: "desc" },
      take: 5
    }),
    prisma.transaction.findMany({
      where: { status: TransactionStatus.COMPLETED },
      select: {
        id: true,
        number: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.stockMovement.findMany({
      where: { type: StockMovementType.ADJUSTMENT },
      select: {
        id: true,
        createdAt: true,
        refId: true,
        product: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    getInventorySettings()
  ]);

  const topProductIds = topProductAggregates.map((item) => item.productId);
  const topProductDetails = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, sku: true }
      })
    : [];
  const topProductDetailMap = new Map(topProductDetails.map((product) => [product.id, product]));

  const todaySales = todayTransactions.reduce((sum, tx) => sum + toNumber(tx.totalAmount), 0);
  const yesterdaySales = yesterdayTransactions.reduce((sum, tx) => sum + toNumber(tx.totalAmount), 0);

  const todayProfit = profitItems2d
    .filter((item) => item.transaction.createdAt >= todayStart)
    .reduce((sum, item) => sum + toNumber(item.subtotal) - toNumber(item.costAtSale) * toNumber(item.qty), 0);
  const yesterdayProfit = profitItems2d
    .filter((item) => item.transaction.createdAt >= yesterdayStart && item.transaction.createdAt < todayStart)
    .reduce((sum, item) => sum + toNumber(item.subtotal) - toNumber(item.costAtSale) * toNumber(item.qty), 0);

  const todayCash = todayTransactions.reduce((sum, tx) => {
    if (tx.paymentMethod === PaymentMethod.CASH) return sum + toNumber(tx.totalAmount);
    if (tx.paymentMethod === PaymentMethod.SPLIT) return sum + toNumber(tx.cashAmount);
    return sum;
  }, 0);
  const yesterdayCash = yesterdayTransactions.reduce((sum, tx) => {
    if (tx.paymentMethod === PaymentMethod.CASH) return sum + toNumber(tx.totalAmount);
    if (tx.paymentMethod === PaymentMethod.SPLIT) return sum + toNumber(tx.cashAmount);
    return sum;
  }, 0);

  const salesLast30 = topProductAggregates.reduce((sum, item) => sum + toNumber(item._sum.subtotal), 0);
  const topProducts = topProductAggregates
    .map((item) => {
      const product = topProductDetailMap.get(item.productId);
      if (!product) return null;
      const sales = toNumber(item._sum.subtotal);
      return {
        id: item.productId,
        name: product.name,
        sku: product.sku,
        quantity: toNumber(item._sum.qty),
        sales,
        contributionPct: salesLast30 > 0 ? (sales / salesLast30) * 100 : 0
      } satisfies TopProductItem;
    })
    .filter((item): item is TopProductItem => item !== null);

  const threshold = inventorySettings.lowStockThreshold;
  let outOfStock = 0;
  let lowStock = 0;
  let healthy = 0;
  let negative = 0;
  let costValue = 0;
  let sellingValue = 0;

  for (const product of products) {
    const stock = toNumber(product.stockQty);
    const unitCost = toNumber(product.unitCost);
    const sellingPrice = toNumber(product.sellingPrice);

    costValue += stock * unitCost;
    sellingValue += stock * sellingPrice;

    if (stock < 0) {
      negative += 1;
    } else if (stock === 0) {
      outOfStock += 1;
    } else if (stock <= threshold) {
      lowStock += 1;
    } else {
      healthy += 1;
    }
  }

  const lowStockAlerts = inventorySettings.enableLowStockAlerts
    ? [...products]
        .filter((product) => toNumber(product.stockQty) <= threshold)
        .sort((a, b) => toNumber(a.stockQty) - toNumber(b.stockQty))
        .slice(0, 5)
        .map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          stock: toNumber(product.stockQty),
          threshold
        }))
    : [];

  const paymentBreakdown: PaymentBreakdownItem[] = [
    {
      key: "cash",
      label: "Cash",
      amount: todayTransactions.reduce((sum, tx) => {
        if (tx.paymentMethod === PaymentMethod.CASH) return sum + toNumber(tx.totalAmount);
        if (tx.paymentMethod === PaymentMethod.SPLIT) return sum + toNumber(tx.cashAmount);
        return sum;
      }, 0),
      count: todayTransactions.filter(
        (tx) =>
          tx.paymentMethod === PaymentMethod.CASH ||
          (tx.paymentMethod === PaymentMethod.SPLIT && toNumber(tx.cashAmount) > 0)
      ).length
    },
    {
      key: "gcash",
      label: "GCash",
      amount: todayTransactions.reduce((sum, tx) => {
        if (tx.paymentMethod === PaymentMethod.QR) return sum + toNumber(tx.totalAmount);
        if (tx.paymentMethod === PaymentMethod.SPLIT) return sum + toNumber(tx.qrAmount);
        return sum;
      }, 0),
      count: todayTransactions.filter(
        (tx) =>
          tx.paymentMethod === PaymentMethod.QR ||
          (tx.paymentMethod === PaymentMethod.SPLIT && toNumber(tx.qrAmount) > 0)
      ).length
    },
    {
      key: "card",
      label: "Card",
      amount: 0,
      count: 0
    },
    {
      key: "others",
      label: "Others",
      amount: 0,
      count: 0
    }
  ];

  const recentActivity = [
    ...recentSales.map((sale) => ({
      id: `sale-${sale.id}`,
      type: "sale" as const,
      label: "Sale completed",
      reference: sale.number,
      timestamp: sale.createdAt.toISOString(),
      href: "/pos"
    })),
    ...recentPurchases.map((purchase) => ({
      id: `purchase-${purchase.id}`,
      type: "purchase" as const,
      label: `Purchase ${String(purchase.status).toLowerCase()}`,
      reference: purchase.purchaseNumber,
      timestamp: purchase.purchaseDate.toISOString(),
      href: "/purchases"
    })),
    ...recentAdjustments.map((movement) => ({
      id: `adjustment-${movement.id}`,
      type: "adjustment" as const,
      label: `Adjustment: ${movement.product.name}`,
      reference: movement.refId ?? "Manual adjustment",
      timestamp: movement.createdAt.toISOString(),
      href: "/inventory"
    }))
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  timer.end({
    todayTransactions: todayTransactions.length,
    topProducts: topProducts.length,
    products: products.length
  });

  return {
    kpis: {
      todaySales: buildComparison(todaySales, yesterdaySales),
      todayProfit: buildComparison(todayProfit, yesterdayProfit),
      transactionsToday: buildComparison(todayTransactions.length, yesterdayTransactions.length),
      cashOnHand: buildComparison(todayCash, yesterdayCash)
    },
    salesTrend: {
      today: [],
      last7: [],
      last30: []
    },
    inventoryHealth: {
      metrics: [
        { label: "Out of Stock", value: outOfStock, tone: outOfStock > 0 ? "danger" : "neutral", href: "/inventory" },
        { label: "Low Stock", value: lowStock, tone: lowStock > 0 ? "warning" : "neutral", href: "/inventory" },
        { label: "Healthy", value: healthy, tone: "success", href: "/inventory" },
        { label: "Negative", value: negative, tone: negative > 0 ? "danger" : "neutral", href: "/inventory" }
      ],
      lowStockAlertsEnabled: inventorySettings.enableLowStockAlerts,
      lowStockAlerts
    },
    paymentBreakdown,
    topProducts,
    actionRequired: [],
    alerts: [],
    recentActivity,
    inventoryValue: {
      costValue,
      sellingValue
    },
    insights: []
  };
}
