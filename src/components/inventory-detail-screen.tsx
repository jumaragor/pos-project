"use client";

import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/format";

type InventoryDetail = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  compatibleUnits: string;
  barcode: string | null;
  unit: string;
  unitCost: number;
  sellingPrice: number;
  stockQty: number;
  isActive: boolean;
  lowStockThreshold: number;
  lastSupplier: string | null;
  createdAt: string;
  updatedAt: string;
  uomCode: string | null;
  uomName: string | null;
};

type InventoryMovement = {
  id: string;
  createdAt: string;
  type: string;
  quantityChange: number;
  reference: string;
  reason: string;
  actor: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function InventoryDetailScreen({
  item,
  stockStatus,
  movements
}: {
  item: InventoryDetail;
  stockStatus: { label: string; className: string };
  movements: InventoryMovement[];
}) {
  const itemStatusLabel = item.isActive ? "Active" : "Archived";
  const itemStatusClass = item.isActive ? "inventory-status-in" : "inventory-status-out";
  const uomLabel = item.uomCode ? `${item.uomCode}${item.uomName ? ` - ${item.uomName}` : ""}` : item.unit;

  return (
    <div className="grid inventory-detail-page">
      <section className="card inventory-detail-card">
        <div className="inventory-detail-head">
          <Link href="/inventory" className="inventory-detail-back">
            Inventory
          </Link>
        </div>
        <div className="inventory-summary-columns">
          <div className="inventory-summary-column">
            <div className="inventory-summary-section">
              <div className="inventory-summary-label">Product Information</div>
              <div className="inventory-summary-grid">
                <div className="inventory-summary-field inventory-summary-field-span-2">
                  <span>Product Name</span>
                  <strong title={item.name}>{item.name}</strong>
                </div>
                <div className="inventory-summary-field">
                  <span>SKU</span>
                  <strong>{item.sku}</strong>
                </div>
                <div className="inventory-summary-field">
                  <span>Category</span>
                  <strong>{item.category || "-"}</strong>
                </div>
                <div className="inventory-summary-field">
                  <span>UOM</span>
                  <strong>{uomLabel || "-"}</strong>
                </div>
                <div className="inventory-summary-field">
                  <span>Status</span>
                  <strong>
                    <span className={`badge ${itemStatusClass}`}>{itemStatusLabel}</span>
                  </strong>
                </div>
              </div>
            </div>

            <div className="inventory-summary-section">
              <div className="inventory-summary-label">Additional Details</div>
              <div className="inventory-summary-grid">
                <div className="inventory-summary-field inventory-summary-field-span-2">
                  <span>Last Supplier</span>
                  <strong>{item.lastSupplier || "-"}</strong>
                </div>
                <div className="inventory-summary-field inventory-summary-field-span-2">
                  <span>Description</span>
                  <strong>{item.description || "-"}</strong>
                </div>
                <div className="inventory-summary-field inventory-summary-field-span-2">
                  <span>Compatible Units</span>
                  <strong>{item.compatibleUnits || "-"}</strong>
                </div>
                <div className="inventory-summary-field">
                  <span>Barcode</span>
                  <strong>{item.barcode || "-"}</strong>
                </div>
              </div>
            </div>

            <div className="inventory-summary-section">
              <div className="inventory-summary-grid">
                <div className="inventory-summary-field">
                  <span>Created</span>
                  <strong>{formatDateTime(item.createdAt)}</strong>
                </div>
                <div className="inventory-summary-field">
                  <span>Updated</span>
                  <strong>{formatDateTime(item.updatedAt)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="inventory-summary-column">
            <div className="inventory-summary-label">Stock & Pricing</div>
            <div className="inventory-summary-grid">
              <div className="inventory-summary-field">
                <span>Qty. on Hand</span>
                <strong>{formatNumber(item.stockQty)}</strong>
              </div>
              <div className="inventory-summary-field">
                <span>Stock Status</span>
                <strong>
                  <span className={`badge ${stockStatus.className}`}>{stockStatus.label}</span>
                </strong>
              </div>
              <div className="inventory-summary-field">
                <span>Unit Cost</span>
                <strong>{formatCurrency(item.unitCost)}</strong>
              </div>
              <div className="inventory-summary-field">
                <span>Price</span>
                <strong>{formatCurrency(item.sellingPrice)}</strong>
              </div>
              <div className="inventory-summary-field" />
            </div>
          </div>
        </div>
      </section>

      <section className="card inventory-detail-card">
        <h2 className="section-title">Recent Movement</h2>
        <div className="table-wrap inventory-detail-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Quantity Change</th>
                <th>Reference</th>
                <th>Reason</th>
                <th>Processed By</th>
              </tr>
            </thead>
            <tbody>
              {movements.length ? (
                movements.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{row.type}</td>
                    <td className={row.quantityChange > 0 ? "trend-up" : row.quantityChange < 0 ? "trend-down" : undefined}>
                      {row.quantityChange > 0 ? `+${formatNumber(row.quantityChange)}` : formatNumber(row.quantityChange)}
                    </td>
                    <td>{row.reference || "-"}</td>
                    <td>{row.reason || "-"}</td>
                    <td>{row.actor || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="muted">
                    No stock movement history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
