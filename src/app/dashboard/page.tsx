import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/data-table";
import { MetricWidget } from "@/components/ui/metric-widget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [transactions, products] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: start }, status: TransactionStatus.COMPLETED },
      include: { items: { include: { product: true } } }
    }),
    prisma.product.findMany({ orderBy: { stockQty: "asc" } })
  ]);

  const lowStock = products.filter((product) => Number(product.stockQty) <= Number(product.lowStockThreshold));
  const todaySales = transactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0);
  const todayProfit = transactions.reduce((sum, transaction) => {
    const cost = transaction.items.reduce(
      (itemSum, item) => itemSum + Number(item.costAtSale) * Number(item.qty),
      0
    );
    return sum + Number(transaction.totalAmount) - cost;
  }, 0);
  const cashOnHand = transactions.reduce((sum, transaction) => {
    if (transaction.paymentMethod === "CASH") return sum + Number(transaction.totalAmount);
    if (transaction.paymentMethod === "SPLIT") return sum + Number(transaction.cashAmount ?? 0);
    return sum;
  }, 0);

  const topSellingMap = new Map<string, { name: string; qty: number; sales: number }>();
  for (const transaction of transactions) {
    for (const item of transaction.items) {
      const existing = topSellingMap.get(item.productId) ?? {
        name: item.product.name,
        qty: 0,
        sales: 0
      };
      existing.qty += Number(item.qty);
      existing.sales += Number(item.subtotal);
      topSellingMap.set(item.productId, existing);
    }
  }
  const topSelling = [...topSellingMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

  return (
    <div className="grid">
      <div className="grid grid-4">
        <MetricWidget label="Today's Sales" value={`PHP ${todaySales.toFixed(2)}`} trend="+3.2%" trendDir="up" />
        <MetricWidget
          label="Today's Profit"
          value={`PHP ${todayProfit.toFixed(2)}`}
          trend={todayProfit >= 0 ? "+2.1%" : "-2.1%"}
          trendDir={todayProfit >= 0 ? "up" : "down"}
        />
        <MetricWidget
          label="Transactions Today"
          value={`${transactions.length}`}
          trend={transactions.length > 0 ? "+1.4%" : "0.0%"}
          trendDir="up"
        />
        <MetricWidget label="Cash on Hand" value={`PHP ${cashOnHand.toFixed(2)}`} trend="+0.8%" trendDir="up" />
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
                  <td>{item.qty}</td>
                  <td>PHP {item.sales.toFixed(2)}</td>
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
              {lowStock.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td>{Number(item.stockQty)}</td>
                  <td>{Number(item.lowStockThreshold)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>
    </div>
  );
}
