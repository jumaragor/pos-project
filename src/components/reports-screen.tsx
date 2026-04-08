"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { useToast } from "@/components/toast-provider";
import { formatCurrency, formatNumber } from "@/lib/format";

type ReportTab = "overview" | "sales" | "product" | "inventory" | "purchase" | "customer";

type OverviewResponse = {
  sales: number;
  transactionCount: number;
  averageSale: number;
  profitEstimate: number | null;
  salesTrend: Array<{ date: string; total: number }>;
  paymentBreakdown: Array<{ paymentMethod: string; _sum: { totalAmount: string } }>;
  topItems: Array<{ productId: string; productName: string; qty: number; subtotal: number }>;
};

type SalesRow = {
  id: string;
  date: string;
  receiptNo: string;
  items: number;
  paymentMethod: string;
  total: number;
};

type ProductPerformanceRow = {
  productName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
};

type InventoryRow = {
  id: string;
  name: string;
  category: string;
  stockQty: string;
  lowStockThreshold?: string;
};

type PurchaseRow = {
  id: string;
  date: string;
  supplier: string;
  items: number;
  totalCost: number;
};

type CustomerRow = {
  customerName: string;
  visits: number;
  totalSpent: number;
  lastVisit: string | null;
};

const tabMeta: Array<{ key: ReportTab; label: string }> = [
  { key: "overview", label: "Sales Overview" },
  { key: "sales", label: "Sales Report" },
  { key: "product", label: "Product Performance" },
  { key: "inventory", label: "Inventory Report" },
  { key: "purchase", label: "Purchase Report" },
  { key: "customer", label: "Customer Report" }
];

function formatMoney(value: number) {
  return formatCurrency(value);
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function ReportsScreen() {
  const { success } = useToast();
  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);

  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [overviewPreset, setOverviewPreset] = useState("monthly");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [productRows, setProductRows] = useState<ProductPerformanceRow[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesFrom, setSalesFrom] = useState(dateInput(monthStart));
  const [salesTo, setSalesTo] = useState(dateInput(now));

  const loadOverview = useCallback(async () => {
    const response = await fetch(`/api/reports/summary?preset=${overviewPreset}`);
    const json = (await response.json()) as OverviewResponse;
    setOverview(json);
  }, [overviewPreset]);

  const loadSales = useCallback(async () => {
    const params = new URLSearchParams({ from: salesFrom, to: salesTo });
    const response = await fetch(`/api/reports/sales?${params.toString()}`);
    const json = (await response.json()) as SalesRow[];
    setSalesRows(json);
  }, [salesFrom, salesTo]);

  const loadOtherReports = useCallback(async () => {
    const [productRes, inventoryRes, purchaseRes, customerRes] = await Promise.all([
      fetch("/api/reports/product-performance"),
      fetch("/api/reports/inventory"),
      fetch("/api/reports/purchases"),
      fetch("/api/reports/customers")
    ]);
    const [productJson, inventoryJson, purchaseJson, customerJson] = await Promise.all([
      productRes.json(),
      inventoryRes.json(),
      purchaseRes.json(),
      customerRes.json()
    ]);
    setProductRows(productJson);
    setInventoryRows(inventoryJson);
    setPurchaseRows(purchaseJson);
    setCustomerRows(customerJson);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOverview(), loadSales(), loadOtherReports()]).finally(() => setLoading(false));
  }, [loadOverview, loadSales, loadOtherReports]);

  function exportSalesCsv() {
    const header = "Date,Receipt No.,Items,Payment Method,Total";
    const body = salesRows.map((row) =>
      [
        formatDateTime(row.date),
        row.receiptNo,
        row.items.toString(),
        row.paymentMethod,
        formatNumber(row.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${salesFrom}-to-${salesTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    success("Processed successfully");
  }

  function printReport() {
    window.print();
    success("Transaction printed successfully");
  }

  const trendSeries = overview?.salesTrend ?? [];
  const trendMax = Math.max(...trendSeries.map((point) => point.total), 1);
  const trendWidth = 760;
  const trendHeight = 220;
  const trendPadding = 20;
  const trendInnerWidth = Math.max(1, trendWidth - trendPadding * 2);
  const trendInnerHeight = Math.max(1, trendHeight - trendPadding * 2);
  const trendPath =
    trendSeries.length > 1
      ? trendSeries
          .map((point, index) => {
            const x = trendPadding + (index / (trendSeries.length - 1)) * trendInnerWidth;
            const y = trendPadding + (1 - point.total / trendMax) * trendInnerHeight;
            return `${x},${y}`;
          })
          .join(" ")
      : "";

  return (
    <div className="grid reports-screen">
      <div className="card">
        <div className="reports-tabs" role="tablist" aria-label="Report pages">
          {tabMeta.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? "reports-tab active" : "reports-tab"}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="grid">
          <div className="card">
            <div className="inventory-table-head">
              <h2 className="section-title">Sales Overview</h2>
              <div className="row">
                <select value={overviewPreset} onChange={(event) => setOverviewPreset(event.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <SecondaryButton onClick={() => void loadOverview()}>Refresh</SecondaryButton>
              </div>
            </div>

            <div className="grid grid-4">
              <div className="card reports-metric-card reports-metric-sales">
                <span className="muted">Total Sales</span>
                <strong>{formatMoney(overview?.sales ?? 0)}</strong>
              </div>
              <div className="card reports-metric-card reports-metric-transactions">
                <span className="muted">Transactions</span>
                <strong>{formatNumber(overview?.transactionCount ?? 0)}</strong>
              </div>
              <div className="card reports-metric-card reports-metric-profit">
                <span className="muted">Profit</span>
                <strong>{overview?.profitEstimate == null ? "Owner only" : formatMoney(overview.profitEstimate)}</strong>
              </div>
              <div className="card reports-metric-card reports-metric-average">
                <span className="muted">Average Sale</span>
                <strong>{formatMoney(overview?.averageSale ?? 0)}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Sales Trend</h3>
            <div className="reports-trend-chart">
              {trendSeries.length > 1 ? (
                <svg
                  viewBox={`0 0 ${trendWidth} ${trendHeight}`}
                  className="reports-trend-svg"
                  role="img"
                  aria-label="Sales trend line chart"
                >
                  <polyline points={trendPath} className="reports-trend-line" />
                  {trendSeries.map((point, index) => {
                    const x = trendPadding + (index / (trendSeries.length - 1)) * trendInnerWidth;
                    const y = trendPadding + (1 - point.total / trendMax) * trendInnerHeight;
                    return <circle key={point.date} cx={x} cy={y} r="3.5" className="reports-trend-dot" />;
                  })}
                </svg>
              ) : (
                <div className="muted">No trend data yet.</div>
              )}
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h3 className="section-title">Payment Method Breakdown</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Payment Method</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.paymentBreakdown ?? []).map((item) => (
                      <tr key={item.paymentMethod}>
                        <td>{item.paymentMethod}</td>
                        <td>{formatMoney(Number(item._sum.totalAmount ?? 0))}</td>
                      </tr>
                    ))}
                    {!overview?.paymentBreakdown?.length ? (
                      <tr>
                        <td colSpan={2} className="muted">No payment data.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">Top Selling Items</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.topItems ?? []).map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{formatNumber(item.qty)}</td>
                        <td>{formatMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                    {!overview?.topItems?.length ? (
                      <tr>
                        <td colSpan={3} className="muted">No top item data.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "sales" ? (
        <div className="card">
          <div className="inventory-table-head">
            <h2 className="section-title">Sales Report</h2>
            <div className="row">
              <SecondaryButton onClick={exportSalesCsv}>Export CSV</SecondaryButton>
              <PrimaryButton className="reports-action-btn" onClick={printReport}>
                Print Report
              </PrimaryButton>
            </div>
          </div>

          <div className="reports-filter-row">
            <label className="form-field">
              <span className="field-label">From</span>
              <input type="date" value={salesFrom} onChange={(event) => setSalesFrom(event.target.value)} />
            </label>
            <label className="form-field">
              <span className="field-label">To</span>
              <input type="date" value={salesTo} onChange={(event) => setSalesTo(event.target.value)} />
            </label>
            <PrimaryButton className="reports-action-btn" onClick={() => void loadSales()}>
              Apply Filter
            </PrimaryButton>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt No.</th>
                  <th>Items</th>
                  <th>Payment Method</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.date)}</td>
                    <td>{row.receiptNo}</td>
                    <td>{formatNumber(row.items)}</td>
                    <td>{row.paymentMethod}</td>
                    <td>{formatMoney(row.total)}</td>
                  </tr>
                ))}
                {!salesRows.length ? (
                  <tr>
                    <td colSpan={5} className="muted">No sales data for selected date range.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "product" ? (
        <div className="card">
          <h2 className="section-title">Product Performance</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Quantity Sold</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((row) => (
                  <tr key={row.productName}>
                    <td>{row.productName}</td>
                    <td>{formatNumber(row.quantitySold)}</td>
                    <td>{formatMoney(row.revenue)}</td>
                    <td>{formatMoney(row.profit)}</td>
                  </tr>
                ))}
                {!productRows.length ? (
                  <tr>
                    <td colSpan={4} className="muted">No product performance data.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "inventory" ? (
        <div className="card">
          <h2 className="section-title">Inventory Report</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((row) => {
                  const stock = Number(row.stockQty ?? 0);
                  const threshold = Number(row.lowStockThreshold ?? 0);
                  const status = stock <= 0 ? "Out of Stock" : stock <= threshold ? "Low Stock" : "In Stock";
                  const statusClass =
                    stock <= 0 ? "inventory-status-out" : stock <= threshold ? "inventory-status-low" : "inventory-status-in";
                  return (
                    <tr key={row.id} className={status === "Low Stock" ? "reports-low-stock-row" : undefined}>
                      <td>{row.name}</td>
                      <td>{row.category}</td>
                      <td>{formatNumber(stock)}</td>
                      <td>
                        <span className={`badge ${statusClass}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
                {!inventoryRows.length ? (
                  <tr>
                    <td colSpan={4} className="muted">No inventory data.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "purchase" ? (
        <div className="card">
          <h2 className="section-title">Purchase Report</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchaseRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateOnly(row.date)}</td>
                    <td>{row.supplier}</td>
                    <td>{formatNumber(row.items)}</td>
                    <td>{formatMoney(row.totalCost)}</td>
                  </tr>
                ))}
                {!purchaseRows.length ? (
                  <tr>
                    <td colSpan={4} className="muted">No purchase records.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "customer" ? (
        <div className="card">
          <h2 className="section-title">Customer Report</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Visits</th>
                  <th>Total Spent</th>
                  <th>Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((row) => (
                  <tr key={row.customerName}>
                    <td>{row.customerName}</td>
                    <td>{formatNumber(row.visits)}</td>
                    <td>{formatMoney(row.totalSpent)}</td>
                    <td>{row.lastVisit ? formatDateTime(row.lastVisit) : "-"}</td>
                  </tr>
                ))}
                {!customerRows.length ? (
                  <tr>
                    <td colSpan={4} className="muted">No customer report data.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {loading ? <div className="muted">Loading reports...</div> : null}
    </div>
  );
}
