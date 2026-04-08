import {
  PaymentMethod,
  PurchaseStatus,
  StockMovementType,
  TransactionStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getInventorySettings } from "@/lib/inventory-settings";

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

function groupTrendPoints(labels: string[], values: Map<string, number>) {
  return labels.map((label) => ({
    label,
    value: values.get(label) ?? 0
  }));
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const yesterdayStart = startOfDay(addDays(now, -1));
  const last7Start = startOfDay(addDays(now, -6));
  const last30Start = startOfDay(addDays(now, -29));

  const [
    transactions30,
    transactionItems30,
    profitItems2d,
    products,
    purchases,
    pendingPurchasesCount,
    recentSales,
    recentAdjustments,
    inventorySettings
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        status: TransactionStatus.COMPLETED,
        createdAt: { gte: last30Start, lt: tomorrowStart }
      },
      select: {
        id: true,
        number: true,
        totalAmount: true,
        paymentMethod: true,
        cashAmount: true,
        qrAmount: true,
        createdAt: true,
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.transactionItem.findMany({
      where: {
        transaction: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: last30Start, lt: tomorrowStart }
        }
      },
      select: {
        productId: true,
        qty: true,
        subtotal: true,
        product: { select: { name: true, sku: true } }
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
    prisma.purchase.findMany({
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        status: true,
        supplierName: true,
        supplier: { select: { supplierName: true } }
      },
      orderBy: { purchaseDate: "desc" },
      take: 10
    }),
    prisma.purchase.count({
      where: { status: PurchaseStatus.DRAFT }
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

  const todayTransactions = transactions30.filter(
    (tx) => tx.createdAt >= todayStart && tx.createdAt < tomorrowStart
  );
  const yesterdayTransactions = transactions30.filter(
    (tx) => tx.createdAt >= yesterdayStart && tx.createdAt < todayStart
  );

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

  const trendToday = new Map<string, number>();
  for (let hour = 0; hour < 24; hour += 1) {
    trendToday.set(`${hour.toString().padStart(2, "0")}:00`, 0);
  }
  const trendLast7 = new Map<string, number>();
  const trendLast30 = new Map<string, number>();
  const labelsLast7: string[] = [];
  const labelsLast30: string[] = [];

  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const date = addDays(now, -daysAgo);
    const label = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(date);
    labelsLast7.push(label);
    trendLast7.set(label, 0);
  }
  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const date = addDays(now, -daysAgo);
    const label = new Intl.DateTimeFormat("en-PH", { month: "numeric", day: "numeric" }).format(date);
    labelsLast30.push(label);
    trendLast30.set(label, 0);
  }

  for (const tx of transactions30) {
    const amount = toNumber(tx.totalAmount);
    if (tx.createdAt >= todayStart) {
      const hourLabel = `${tx.createdAt.getHours().toString().padStart(2, "0")}:00`;
      trendToday.set(hourLabel, (trendToday.get(hourLabel) ?? 0) + amount);
    }
    if (tx.createdAt >= last7Start) {
      const label = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(tx.createdAt);
      trendLast7.set(label, (trendLast7.get(label) ?? 0) + amount);
    }
    const label30 = new Intl.DateTimeFormat("en-PH", { month: "numeric", day: "numeric" }).format(tx.createdAt);
    trendLast30.set(label30, (trendLast30.get(label30) ?? 0) + amount);
  }

  const topProductMap = new Map<string, TopProductItem>();
  for (const item of transactionItems30) {
    const existing = topProductMap.get(item.productId) ?? {
      id: item.productId,
      name: item.product.name,
      sku: item.product.sku,
      quantity: 0,
      sales: 0,
      contributionPct: 0
    };
    existing.quantity += toNumber(item.qty);
    existing.sales += toNumber(item.subtotal);
    topProductMap.set(item.productId, existing);
  }
  const salesLast30 = transactions30.reduce((sum, tx) => sum + toNumber(tx.totalAmount), 0);
  const topProducts = [...topProductMap.values()]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      contributionPct: salesLast30 > 0 ? (item.sales / salesLast30) * 100 : 0
    }));

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
        .filter((product) => {
          const stock = toNumber(product.stockQty);
          return stock <= threshold;
        })
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
        (tx) => tx.paymentMethod === PaymentMethod.CASH || (tx.paymentMethod === PaymentMethod.SPLIT && toNumber(tx.cashAmount) > 0)
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
        (tx) => tx.paymentMethod === PaymentMethod.QR || (tx.paymentMethod === PaymentMethod.SPLIT && toNumber(tx.qrAmount) > 0)
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

  const alerts: AlertItem[] = [
    { label: "Out of stock items", value: outOfStock, tone: outOfStock > 0 ? "danger" : "info", href: "/inventory" },
    { label: "Negative inventory", value: negative, tone: negative > 0 ? "danger" : "info", href: "/inventory" },
    {
      label: "Low stock for reorder",
      value: lowStock,
      tone: lowStock > 0 ? "warning" : "info",
      href: "/inventory"
    },
    {
      label: "Pending purchases",
      value: pendingPurchasesCount,
      tone: pendingPurchasesCount > 0 ? "warning" : "info",
      href: "/purchases"
    }
  ];

  const actionRequired: ActionRequiredItem[] = [];
  if (negative > 0) {
    actionRequired.push({
      type: "negative",
      count: negative,
      severity: "high",
      message: `${negative} product${negative === 1 ? "" : "s"} have negative inventory`,
      href: "/inventory?filter=negative"
    });
  }
  if (outOfStock > 0) {
    actionRequired.push({
      type: "out",
      count: outOfStock,
      severity: "high",
      message: `${outOfStock} product${outOfStock === 1 ? " is" : "s are"} out of stock`,
      href: "/inventory?filter=out"
    });
  }
  if (lowStock > 0) {
    actionRequired.push({
      type: "low",
      count: lowStock,
      severity: "medium",
      message: `${lowStock} product${lowStock === 1 ? " needs" : "s need"} restocking`,
      href: "/inventory?filter=low"
    });
  }
  if (todayTransactions.length === 0) {
    actionRequired.push({
      type: "no-sales",
      count: 0,
      severity: "low",
      message: "No sales recorded today",
      href: "/pos"
    });
  }
  if (pendingPurchasesCount > 0) {
    actionRequired.push({
      type: "pending",
      count: pendingPurchasesCount,
      severity: "medium",
      message: `${pendingPurchasesCount} purchase${pendingPurchasesCount === 1 ? " is" : "s are"} pending`,
      href: "/purchases"
    });
  }

  const recentActivity = [
    ...recentSales.map((sale) => ({
      id: `sale-${sale.id}`,
      type: "sale" as const,
      label: "Sale completed",
      reference: sale.number,
      timestamp: sale.createdAt.toISOString(),
      href: "/pos"
    })),
    ...purchases.map((purchase) => ({
      id: `purchase-${purchase.id}`,
      type: "purchase" as const,
      label: purchase.status === PurchaseStatus.DRAFT ? "Purchase draft" : "Purchase posted",
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

  const bestSeller = topProducts[0];
  const insights: InsightItem[] = [];
  if (todaySales > 0 || yesterdaySales > 0) {
    insights.push({
      id: "sales-trend",
      text:
        todaySales >= yesterdaySales
          ? "Sales are holding or improving versus yesterday."
          : "Sales are trailing yesterday. Check payment mix and top-moving items.",
      tone: todaySales >= yesterdaySales ? "success" : "warning"
    });
  }
  if (bestSeller) {
    insights.push({
      id: "top-product",
      text: `${bestSeller.name} is leading today’s momentum with ${bestSeller.contributionPct.toFixed(1)}% of the last 30 days’ sales mix.`,
      tone: "info"
    });
  }
  if (negative > 0 || outOfStock > 0 || lowStock > 0) {
    insights.push({
      id: "inventory-risks",
      text: `${negative} negative, ${outOfStock} out-of-stock, and ${lowStock} low-stock items need attention.`,
      tone: negative > 0 || outOfStock > 0 ? "warning" : "info"
    });
  }
  if (!insights.length) {
    insights.push({
      id: "fallback",
      text: "Not enough activity yet. Once sales and inventory movements come in, the dashboard will start surfacing trends.",
      tone: "info"
    });
  }

  return {
    kpis: {
      todaySales: buildComparison(todaySales, yesterdaySales),
      todayProfit: buildComparison(todayProfit, yesterdayProfit),
      transactionsToday: buildComparison(todayTransactions.length, yesterdayTransactions.length),
      cashOnHand: buildComparison(todayCash, yesterdayCash)
    },
    salesTrend: {
      today: groupTrendPoints([...trendToday.keys()], trendToday),
      last7: groupTrendPoints(labelsLast7, trendLast7),
      last30: groupTrendPoints(labelsLast30, trendLast30)
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
    actionRequired,
    alerts,
    recentActivity,
    inventoryValue: {
      costValue,
      sellingValue
    },
    insights
  };
}
