import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getDashboardData } from "@/lib/dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const maxPaymentAmount = Math.max(...data.paymentBreakdown.map((item) => item.amount), 1);

  return (
    <div className="grid dashboard-grid">
      <div className="grid grid-4 dashboard-kpi-grid">
        <KpiCard
          label="Today's Sales"
          value={formatCurrency(data.kpis.todaySales.value)}
        />
        <KpiCard
          label="Today's Profit"
          value={formatCurrency(data.kpis.todayProfit.value)}
        />
        <KpiCard
          label="Transactions Today"
          value={formatNumber(data.kpis.transactionsToday.value)}
        />
        <KpiCard
          label="Cash on Hand"
          value={formatCurrency(data.kpis.cashOnHand.value)}
        />
      </div>

      <div className="grid grid-2 dashboard-main-grid">
        <Card className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2 className="section-title">Inventory Health</h2>
            </div>
          </div>

          <div className="dashboard-health-grid">
            {data.inventoryHealth.metrics.map((metric) => (
              <Link key={metric.label} href={metric.href} className={`dashboard-health-card tone-${metric.tone}`}>
                <span>{metric.label}</span>
                <strong>{formatNumber(metric.value)}</strong>
              </Link>
            ))}
          </div>

          <div className="dashboard-subsection">
            <div className="dashboard-subsection-head">
              <h3>Low Stock Alerts</h3>
              {data.inventoryHealth.lowStockAlertsEnabled ? (
                <Link href="/inventory" className="dashboard-inline-link">
                  Open Inventory
                </Link>
              ) : null}
            </div>
            {!data.inventoryHealth.lowStockAlertsEnabled ? (
              <div className="dashboard-empty">Low stock alerts are disabled.</div>
            ) : data.inventoryHealth.lowStockAlerts.length ? (
              <div className="table-wrap">
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
                    {data.inventoryHealth.lowStockAlerts.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.sku}</td>
                        <td>{formatNumber(item.stock)}</td>
                        <td>{formatNumber(item.threshold)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dashboard-empty">No low stock items right now.</div>
            )}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2 className="section-title">Payment Breakdown</h2>
            </div>
          </div>

          <div className="dashboard-payment-list">
            {data.paymentBreakdown.map((item) => (
              <div key={item.key} className="dashboard-payment-row">
                <div className="dashboard-payment-copy">
                  <strong>{item.label}</strong>
                  <span>{formatNumber(item.count)} transaction(s)</span>
                </div>
                <div className="dashboard-payment-amount">
                  <strong>{formatCurrency(item.amount)}</strong>
                  <div className="dashboard-payment-bar">
                    <span style={{ width: `${(item.amount / maxPaymentAmount) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-2 dashboard-main-grid">
        <Card className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2 className="section-title">Top Products</h2>
              <p className="dashboard-panel-subtitle">Best contributors over the last 30 days</p>
            </div>
          </div>
          {data.topProducts.length ? (
            <div className="dashboard-top-products">
              {data.topProducts.map((product) => (
                <div key={product.id} className="dashboard-top-product-row">
                  <div className="dashboard-top-product-copy">
                    <strong>{product.name}</strong>
                    <span>
                      {product.sku} · {formatNumber(product.quantity)} qty
                    </span>
                  </div>
                  <div className="dashboard-top-product-stats">
                    <strong>{formatCurrency(product.sales)}</strong>
                    <span>{product.contributionPct.toFixed(1)}%</span>
                  </div>
                  <div className="dashboard-top-product-bar">
                    <span style={{ width: `${Math.min(product.contributionPct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">No product sales yet.</div>
          )}
        </Card>
        <DataTable title="Recent Activity">
          {data.recentActivity.length ? (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((activity) => (
                  <tr key={activity.id}>
                    <td className="dashboard-activity-type">{activity.label}</td>
                    <td>
                      {activity.href ? (
                        <Link href={activity.href} className="dashboard-inline-link">
                          {activity.reference}
                        </Link>
                      ) : (
                        activity.reference
                      )}
                    </td>
                    <td>{new Date(activity.timestamp).toLocaleString("en-PH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dashboard-empty">No recent activity yet.</div>
          )}
        </DataTable>
      </div>
    </div>
  );
}
