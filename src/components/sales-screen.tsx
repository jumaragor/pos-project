"use client";

import { useMemo, useRef, useState } from "react";
import { SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { SalesDetail, SalesListRow, SalesPagination } from "@/lib/sales";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH");
}

type SalesInitialState = {
  items: SalesListRow[];
  pagination: SalesPagination;
};

export function SalesScreen({ initialSales }: { initialSales: SalesInitialState }) {
  const [sales, setSales] = useState(initialSales.items);
  const [pagination, setPagination] = useState(initialSales.pagination);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SalesDetail | null>(null);
  const saleDetailCacheRef = useRef<Map<string, SalesDetail>>(new Map());

  const summary = useMemo(
    () => ({
      count: pagination.total,
      total: sales.reduce((sum, sale) => sum + sale.total, 0)
    }),
    [pagination.total, sales]
  );

  async function loadSales(nextDateFrom = dateFrom, nextDateTo = dateTo, nextPage = pagination.page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "25"
      });
      if (nextDateFrom) params.set("dateFrom", nextDateFrom);
      if (nextDateTo) params.set("dateTo", nextDateTo);

      const response = await fetch(`/api/sales${params.toString() ? `?${params.toString()}` : ""}`);
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error ?? "Failed to load sales.");
        return;
      }
      setSales(payload.items ?? []);
      setPagination(payload.pagination ?? initialSales.pagination);
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(id: string) {
    const cachedSale = saleDetailCacheRef.current.get(id);
    if (cachedSale) {
      setSelectedSale(cachedSale);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/sales/${id}`);
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error ?? "Failed to load sale details.");
        return;
      }
      saleDetailCacheRef.current.set(id, payload);
      setSelectedSale(payload);
    } finally {
      setDetailLoading(false);
    }
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    void loadSales("", "", 1);
  }

  return (
    <div className="grid sales-screen">
      <div className="card sales-filters-card">
        <div className="sales-filters-grid">
          <label className="sales-filter-field">
            <span>From Date</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="sales-filter-field">
            <span>To Date</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="sales-filter-actions">
            <SecondaryButton onClick={() => void loadSales(dateFrom, dateTo, 1)} disabled={loading}>
              {loading ? "Loading..." : "Apply Filters"}
            </SecondaryButton>
            <SecondaryButton onClick={clearFilters} disabled={loading && !dateFrom && !dateTo}>
              Clear
            </SecondaryButton>
          </div>
        </div>
      </div>

      <div className="card sales-table-card">
        <div className="sales-table-meta">
          <span>{summary.count} transaction(s)</span>
          <strong>Total Sales: {formatCurrency(summary.total)}</strong>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaction Number</th>
                <th>Date and Time</th>
                <th>Cashier</th>
                <th>Status</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Payment Amount</th>
                <th>Change</th>
                <th>Payment Method</th>
                <th className="sales-actions-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length ? (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.number}</td>
                    <td>{formatDateTime(sale.createdAt)}</td>
                    <td>{sale.cashierName}</td>
                    <td>{sale.status}</td>
                    <td>{formatCurrency(sale.subtotal)}</td>
                    <td>{formatCurrency(sale.discount)}</td>
                    <td>{formatCurrency(sale.tax)}</td>
                    <td>{formatCurrency(sale.total)}</td>
                    <td>{sale.paymentAmount == null ? "-" : formatCurrency(sale.paymentAmount)}</td>
                    <td>{sale.changeAmount == null ? "-" : formatCurrency(sale.changeAmount)}</td>
                    <td>{sale.paymentMethod}</td>
                    <td className="sales-actions-cell">
                      <div className="sales-actions-group">
                        <button className="btn-secondary" onClick={() => void openDetails(sale.id)} disabled={detailLoading}>
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12}>
                    <div className="sales-empty-state">
                      <strong>No sales transactions found.</strong>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inventory-pagination">
          <div>
            Showing {sales.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0} to{" "}
            {(pagination.page - 1) * pagination.pageSize + sales.length} of {pagination.total}
          </div>
          <div className="row">
            <button
              className="btn-secondary"
              disabled={pagination.page <= 1 || loading}
              onClick={() => void loadSales(dateFrom, dateTo, pagination.page - 1)}
            >
              Prev
            </button>
            <span className="badge">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => void loadSales(dateFrom, dateTo, pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedSale ? (
        <div className="inventory-modal-overlay" onClick={() => setSelectedSale(null)}>
          <div
            className="inventory-modal inventory-modal-responsive"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="inventory-modal-header">
              <h3 className="section-title">Sale Details</h3>
              <div className="field-help">{selectedSale.number}</div>
            </div>
            <div className="inventory-modal-body sales-detail-body">
              <div className="sales-detail-grid">
                <div className="sales-detail-card">
                  <span>Date and Time</span>
                  <strong>{formatDateTime(selectedSale.createdAt)}</strong>
                </div>
                <div className="sales-detail-card">
                  <span>Cashier</span>
                  <strong>{selectedSale.cashierName}</strong>
                </div>
                <div className="sales-detail-card">
                  <span>Customer</span>
                  <strong>{selectedSale.customerName ?? "-"}</strong>
                </div>
                <div className="sales-detail-card">
                  <span>Status</span>
                  <strong>{selectedSale.status}</strong>
                </div>
                <div className="sales-detail-card">
                  <span>Payment Method</span>
                  <strong>{selectedSale.paymentMethod}</strong>
                </div>
                <div className="sales-detail-card">
                  <span>Payment Amount</span>
                  <strong>
                    {selectedSale.paymentAmount == null ? "-" : formatCurrency(selectedSale.paymentAmount)}
                  </strong>
                </div>
                <div className="sales-detail-card">
                  <span>Change</span>
                  <strong>
                    {selectedSale.changeAmount == null ? "-" : formatCurrency(selectedSale.changeAmount)}
                  </strong>
                </div>
              </div>

              <div className="sales-detail-section">
                <h4 className="section-title">Transaction Summary</h4>
                <div className="sales-summary-list">
                  <div><span>Subtotal</span><strong>{formatCurrency(selectedSale.subtotal)}</strong></div>
                  <div><span>Discount</span><strong>{formatCurrency(selectedSale.discount)}</strong></div>
                  <div><span>Tax</span><strong>{formatCurrency(selectedSale.tax)}</strong></div>
                  <div><span>Total</span><strong>{formatCurrency(selectedSale.total)}</strong></div>
                </div>
              </div>

              <div className="sales-detail-section">
                <h4 className="section-title">Items Sold</h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU / UOM</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.items.map((item) => (
                        <tr key={`${item.productId}-${item.name}`}>
                          <td>{item.name}</td>
                          <td>{[item.sku, item.uom].filter(Boolean).join(" / ") || "-"}</td>
                          <td>{formatNumber(item.qty)}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="inventory-modal-footer row">
              <SecondaryButton onClick={() => setSelectedSale(null)}>Close</SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
