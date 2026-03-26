import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/data-table";
import { MetricWidget } from "@/components/ui/metric-widget";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getInventorySettings } from "@/lib/inventory-settings";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const completedWhere = { createdAt: { gte: start }, status: TransactionStatus.COMPLETED };
  const [transactions, transactionItems, products, inventorySettings] = await Promise.all([
    prisma.transaction.findMany({
      where: completedWhere,
      select: {
        id: true,
        totalAmount: true,
        paymentMethod: true,
        cashAmount: true
      }
    }),
    prisma.transactionItem.findMany({
      where: { transaction: completedWhere },
      select: {
        productId: true,
        qty: true,
        subtotal: true,
        costAtSale: true,
        product: { select: { name: true } }
      }
    }),
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, stockQty: true },
      orderBy: { stockQty: "asc" },
      take: 8
    }),
    getInventorySettings()
  ]);

  const lowStock = inventorySettings.enableLowStockAlerts
    ? products.filter((product) => Number(product.stockQty) <= inventorySettings.lowStockThreshold)
    : [];
  const todaySales = transactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0);
  const todayProfit =
    todaySales -
    transactionItems.reduce((sum, item) => sum + Number(item.costAtSale) * Number(item.qty), 0);
  const cashOnHand = transactions.reduce((sum, transaction) => {
    if (transaction.paymentMethod === "CASH") return sum + Number(transaction.totalAmount);
    if (transaction.paymentMethod === "SPLIT") return sum + Number(transaction.cashAmount ?? 0);
    return sum;
  }, 0);

  const topSellingMap = new Map<string, { name: string; qty: number; sales: number }>();
  for (const item of transactionItems) {
    const existing = topSellingMap.get(item.productId) ?? {
      name: item.product.name,
      qty: 0,
      sales: 0
    };
    existing.qty += Number(item.qty);
    existing.sales += Number(item.subtotal);
    topSellingMap.set(item.productId, existing);
  }
  const topSelling = [...topSellingMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

  return (
    <div className="grid">
      <div className="grid grid-4">
        <MetricWidget label="Today's Sales" value={formatCurrency(todaySales)} trend="+3.2%" trendDir="up" />
        <MetricWidget
          label="Today's Profit"
          value={formatCurrency(todayProfit)}
          trend={todayProfit >= 0 ? "+2.1%" : "-2.1%"}
          trendDir={todayProfit >= 0 ? "up" : "down"}
        />
        <MetricWidget
          label="Transactions Today"
          value={formatNumber(transactions.length)}
          trend={transactions.length > 0 ? "+1.4%" : "0.0%"}
          trendDir="up"
        />
        <MetricWidget label="Cash on Hand" value={formatCurrency(cashOnHand)} trend="+0.8%" trendDir="up" />
      </div>

      <div className="grid grid-2">
        <DataTable title="Top Selling Products">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty Sold</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody>
              {topSelling.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{formatNumber(item.qty)}</td>
                  <td>{formatCurrency(item.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        <DataTable title="Low Stock Alerts">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {inventorySettings.enableLowStockAlerts ? (
                lowStock.length ? (
                  lowStock.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.sku}</td>
                      <td>{formatNumber(item.stockQty)}</td>
                      <td>{formatNumber(inventorySettings.lowStockThreshold)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="muted">No low stock alerts.</td>
                  </tr>
                )
              ) : (
                <tr>
                  <td colSpan={4} className="muted">Low stock alerts are disabled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DataTable>
      </div>
    </div>
  );
}
