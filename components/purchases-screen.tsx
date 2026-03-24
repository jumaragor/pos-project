"use client";

import { useMemo, useState } from "react";
import { PurchaseStatus, SupplierStatus } from "@prisma/client";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { sanitizeDecimalInput, toNumber } from "@/lib/numeric-input";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

type PurchaseItemRow = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
};

type PurchaseRow = {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string | null;
  supplierName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  totalItems: number;
  totalCost: number;
  status: PurchaseStatus;
  items: PurchaseItemRow[];
};

type SupplierOption = {
  id: string;
  supplierCode: string;
  supplierName: string;
  status: SupplierStatus;
};

type FormMode = "create" | "edit" | "view";

type PurchaseForm = {
  purchaseDate: string;
  supplierId: string;
  referenceNumber: string;
  notes: string;
  status: PurchaseStatus;
  items: PurchaseItemRow[];
};

function emptyItem(products: ProductOption[]): PurchaseItemRow {
  const first = products[0];
  return {
    id: crypto.randomUUID(),
    productId: first?.id ?? "",
    productName: first?.name ?? "",
    quantity: 1,
    unitCost: 0,
    amount: 0,
    taxRate: 0,
    taxAmount: 0,
    lineTotal: 0
  };
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInput(isoDate: string) {
  return new Date(isoDate).toISOString().slice(0, 10);
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatQty(value: number) {
  return Number(value.toFixed(3)).toString();
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function asSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `PHP ${formatCurrency(value)}`;
}

function statusBadgeClass(status: PurchaseStatus, isVoided: boolean) {
  if (isVoided) return "badge inventory-status-out";
  return status === PurchaseStatus.POSTED ? "badge purchases-status-posted" : "badge purchases-status-draft";
}

function displayPurchaseStatus(status: PurchaseStatus, notes: string | null) {
  if (isVoidedPurchaseNote(notes)) return "VOIDED";
  return status;
}

function makeFormFromPurchase(purchase: PurchaseRow): PurchaseForm {
  return {
    purchaseDate: toDateInput(purchase.purchaseDate),
    supplierId: purchase.supplierId ?? "",
    referenceNumber: purchase.referenceNumber ?? "",
    notes: purchase.notes ?? "",
    status: purchase.status,
    items: purchase.items.map((item) => ({
      ...item,
      id: crypto.randomUUID()
    }))
  };
}

export function PurchasesScreen({
  initialPurchases,
  products,
  suppliers
}: {
  initialPurchases: PurchaseRow[];
  products: ProductOption[];
  suppliers: SupplierOption[];
}) {
  const [purchases, setPurchases] = useState(initialPurchases);
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePurchase, setActivePurchase] = useState<PurchaseRow | null>(null);
  const [form, setForm] = useState<PurchaseForm>({
    purchaseDate: todayDateInput(),
    supplierId: suppliers.find((supplier) => supplier.status === SupplierStatus.ACTIVE)?.id ?? "",
    referenceNumber: "",
    notes: "",
    status: PurchaseStatus.POSTED,
    items: [emptyItem(products)]
  });

  async function refresh() {
    const response = await fetch("/api/purchases");
    const payload = await response.json();
    const normalized = payload.map(
      (purchase: {
        id: string;
        purchaseNumber: string;
        purchaseDate: string;
        supplierId: string | null;
        supplierName: string | null;
        referenceNumber: string | null;
        notes: string | null;
        totalItems: string;
        totalCost: string;
        status: PurchaseStatus;
        items: {
          id: string;
          productId: string;
          productName: string;
          quantity: string;
          unitCost: string;
          amount: string;
          taxRate: string;
          taxAmount: string;
          lineTotal: string;
        }[];
      }) => ({
        ...purchase,
        totalItems: Number(purchase.totalItems),
        totalCost: Number(purchase.totalCost),
        items: purchase.items.map((item) => ({
          ...item,
          quantity: asSafeNumber(item.quantity),
          unitCost: asSafeNumber(item.unitCost),
          amount: asSafeNumber(item.amount),
          taxRate: asSafeNumber(item.taxRate),
          taxAmount: asSafeNumber(item.taxAmount),
          lineTotal: asSafeNumber(item.lineTotal)
        }))
      })
    );
    setPurchases(normalized);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((purchase) => {
      return (
        purchase.purchaseNumber.toLowerCase().includes(q) ||
        (purchase.supplierName ?? "").toLowerCase().includes(q) ||
        (purchase.referenceNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [purchases, query]);

  const summary = useMemo(() => {
    const totalItems = form.items.length;
    const subtotal = form.items.reduce(
      (sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0),
      0
    );
    const totalTax = form.items.reduce(
      (sum, item) => sum + (Number.isFinite(item.taxAmount) ? item.taxAmount : 0),
      0
    );
    const grandTotal = form.items.reduce(
      (sum, item) => sum + (Number.isFinite(item.lineTotal) ? item.lineTotal : 0),
      0
    );
    return { totalItems, subtotal, totalTax, grandTotal };
  }, [form.items]);

  function openCreate() {
    setFormMode("create");
    setActivePurchase(null);
    setForm({
      purchaseDate: todayDateInput(),
      supplierId: suppliers.find((supplier) => supplier.status === SupplierStatus.ACTIVE)?.id ?? "",
      referenceNumber: "",
      notes: "",
      status: PurchaseStatus.POSTED,
      items: [emptyItem(products)]
    });
    setOpen(true);
  }

  function openEdit(purchase: PurchaseRow) {
    setFormMode("edit");
    setActivePurchase(purchase);
    setForm(makeFormFromPurchase(purchase));
    setOpen(true);
  }

  function openView(purchase: PurchaseRow) {
    setFormMode("view");
    setActivePurchase(purchase);
    setForm(makeFormFromPurchase(purchase));
    setOpen(true);
  }

  function updateItem(
    itemId: string,
    next: Partial<{
      productId: string;
      quantity: number;
      unitCost: number;
      taxRate: number;
    }>
  ) {
    setForm((prev) => {
      const items = prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const selectedProduct =
          typeof next.productId === "string" ? products.find((product) => product.id === next.productId) : null;
        const quantity = typeof next.quantity === "number" ? next.quantity : item.quantity;
        const unitCost = typeof next.unitCost === "number" ? next.unitCost : item.unitCost;
        const taxRate = typeof next.taxRate === "number" ? next.taxRate : item.taxRate;
        const amount = Number((Math.max(0, quantity) * Math.max(0, unitCost)).toFixed(2));
        const taxAmount = Number((amount * (Math.max(0, taxRate) / 100)).toFixed(2));
        const lineTotal = Number((amount + taxAmount).toFixed(2));
        return {
          ...item,
          productId: next.productId ?? item.productId,
          productName: selectedProduct?.name ?? item.productName,
          quantity: Math.max(0, quantity),
          unitCost: Math.max(0, unitCost),
          amount,
          taxRate: Math.max(0, taxRate),
          taxAmount,
          lineTotal
        };
      });
      return { ...prev, items };
    });
  }

  function addItemRow() {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem(products)] }));
  }

  function removeItemRow(itemId: string) {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((item) => item.id !== itemId) };
    });
  }

  async function savePurchase() {
    if (!form.purchaseDate) {
      alert("Purchase date is required");
      return;
    }
    if (
      !form.items.length ||
      form.items.some(
        (item) => !item.productId || item.quantity <= 0 || item.unitCost < 0 || item.taxRate < 0
      )
    ) {
      alert("Please provide valid purchase items");
      return;
    }

    const payload = {
      purchaseDate: form.purchaseDate,
      supplierId: form.supplierId || null,
      referenceNumber: form.referenceNumber,
      notes: form.notes,
      status: form.status,
      items: form.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        amount: item.amount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount
      }))
    };

    const target = formMode === "edit" && activePurchase ? `/api/purchases/${activePurchase.id}` : "/api/purchases";
    const method = formMode === "edit" ? "PUT" : "POST";

    setSaving(true);
    try {
      const response = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const result = await response.json();
        alert(result.error ?? "Failed to save purchase");
        return;
      }
      setOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deletePurchase(purchase: PurchaseRow) {
    if (isVoidedPurchaseNote(purchase.notes) || purchase.status !== PurchaseStatus.DRAFT) return;
    if (!window.confirm(`Delete draft purchase ${purchase.purchaseNumber}?`)) return;
    const response = await fetch(`/api/purchases/${purchase.id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json();
      alert(result.error ?? "Failed to delete purchase");
      return;
    }
    await refresh();
  }

  async function voidPurchase(purchase: PurchaseRow) {
    if (isVoidedPurchaseNote(purchase.notes) || purchase.status !== PurchaseStatus.POSTED) return;
    if (!window.confirm(`Void posted purchase ${purchase.purchaseNumber}? This will reverse inventory stock-in.`)) return;
    const response = await fetch(`/api/purchases/${purchase.id}/void`, { method: "POST" });
    if (!response.ok) {
      const result = await response.json();
      alert(result.error ?? "Failed to void purchase");
      return;
    }
    await refresh();
  }

  const readOnly = formMode === "view";
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.status === SupplierStatus.ACTIVE),
    [suppliers]
  );
  const supplierChoices = useMemo(() => {
    const selected = suppliers.find((supplier) => supplier.id === form.supplierId);
    if (!selected || selected.status === SupplierStatus.ACTIVE) {
      return activeSuppliers;
    }
    return [selected, ...activeSuppliers];
  }, [suppliers, form.supplierId, activeSuppliers]);

  return (
    <div className="grid purchases-screen">
      <div className="card">
        <div className="inventory-table-head">
          <h2 className="section-title">Purchases</h2>
          <PrimaryButton className="purchases-new-btn" onClick={openCreate}>
            + New Purchase
          </PrimaryButton>
        </div>

        <div className="inventory-filters">
          <div className="muted">Track all restocking and supplier deliveries.</div>
          <input
            className="inventory-search"
            placeholder="Search purchase no., supplier, reference..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Purchase No.</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Number of Items</th>
                <th>Total Cost</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((purchase) => {
                const isVoided = isVoidedPurchaseNote(purchase.notes);
                return (
                  <tr key={purchase.id}>
                    <td>{purchase.purchaseNumber}</td>
                    <td>{formatDate(purchase.purchaseDate)}</td>
                    <td>{purchase.supplierName || "-"}</td>
                    <td>{formatQty(purchase.totalItems)}</td>
                    <td>PHP {purchase.totalCost.toFixed(2)}</td>
                    <td>
                      <span className={statusBadgeClass(purchase.status, isVoided)}>
                        {displayPurchaseStatus(purchase.status, purchase.notes)}
                      </span>
                    </td>
                    <td>
                      <div className="inventory-actions">
                        <button className="btn-info" onClick={() => openView(purchase)}>
                          View
                        </button>
                        {!isVoided && purchase.status === PurchaseStatus.DRAFT ? (
                          <button className="btn-secondary" onClick={() => openEdit(purchase)}>
                            Edit
                          </button>
                        ) : null}
                        {!isVoided && purchase.status === PurchaseStatus.DRAFT ? (
                          <button className="btn-danger" onClick={() => deletePurchase(purchase)}>
                            Delete
                          </button>
                        ) : null}
                        {!isVoided && purchase.status === PurchaseStatus.POSTED ? (
                          <button className="btn-danger" onClick={() => void voidPurchase(purchase)}>
                            Void
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No purchases yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal purchases-modal">
            <h3 className="section-title">
              {formMode === "create" ? "New Purchase" : formMode === "edit" ? "Edit Draft Purchase" : "View Purchase"}
            </h3>

            <div className="stack">
              <div className="grid grid-2">
                <div className="form-field">
                  <label className="field-label">Purchase Date</label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    disabled={readOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, purchaseDate: event.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Status</label>
                  <select
                    value={form.status}
                    disabled={readOnly}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value as PurchaseStatus }))
                    }
                  >
                    <option value={PurchaseStatus.DRAFT}>Draft</option>
                    <option value={PurchaseStatus.POSTED}>Posted</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="form-field">
                  <label className="field-label">Supplier</label>
                  <select
                    value={form.supplierId}
                    disabled={readOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))}
                  >
                    <option value="">Select supplier</option>
                    {supplierChoices.map((supplier) => (
                      <option value={supplier.id} key={supplier.id}>
                        {supplier.supplierName} ({supplier.supplierCode})
                        {supplier.status === SupplierStatus.INACTIVE ? " - Inactive" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label">Reference No. / Invoice No.</label>
                  <input
                    placeholder="Reference number"
                    value={form.referenceNumber}
                    disabled={readOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, referenceNumber: event.target.value }))}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes"
                  value={form.notes}
                  disabled={readOnly}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              <div className="stack">
                <div className="row purchases-items-header">
                  <h4 className="section-title">Purchased Items</h4>
                  {!readOnly ? (
                    <SecondaryButton type="button" onClick={addItemRow}>
                      Add Item
                    </SecondaryButton>
                  ) : null}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Tax Rate</th>
                        <th>Tax Amount</th>
                        <th>Line Total</th>
                        {!readOnly ? <th></th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <select
                              value={item.productId}
                              disabled={readOnly}
                              onChange={(event) => updateItem(item.id, { productId: event.target.value })}
                            >
                              {products.map((product) => (
                                <option value={product.id} key={product.id}>
                                  {product.name} ({product.sku})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.]?[0-9]*"
                              disabled={readOnly}
                              value={item.quantity.toString()}
                              onChange={(event) => {
                                const next = sanitizeDecimalInput(event.target.value);
                                updateItem(item.id, { quantity: toNumber(next) });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.]?[0-9]*"
                              disabled={readOnly}
                              value={item.unitCost.toString()}
                              onChange={(event) => {
                                const next = sanitizeDecimalInput(event.target.value);
                                updateItem(item.id, { unitCost: toNumber(next) });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.]?[0-9]*"
                              disabled={readOnly}
                              value={item.taxRate.toString()}
                              onChange={(event) => {
                                const next = sanitizeDecimalInput(event.target.value);
                                updateItem(item.id, { taxRate: toNumber(next) });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              readOnly
                              className="purchases-computed-input"
                              value={formatMoney(item.taxAmount)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              readOnly
                              className="purchases-computed-input"
                              value={formatMoney(item.lineTotal)}
                            />
                          </td>
                          {!readOnly ? (
                            <td>
                              <button className="btn-danger" onClick={() => removeItemRow(item.id)}>
                                Remove
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card purchases-summary">
                <div>
                  <span>Total Items</span>
                  <strong>{formatQty(summary.totalItems)}</strong>
                </div>
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(summary.subtotal)}</strong>
                </div>
                <div>
                  <span>Total Tax</span>
                  <strong>{formatMoney(summary.totalTax)}</strong>
                </div>
                <div>
                  <span>Grand Total</span>
                  <strong>{formatMoney(summary.grandTotal)}</strong>
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
              {!readOnly ? (
                <PrimaryButton onClick={savePurchase} disabled={saving}>
                  {saving ? "Saving..." : "Save Purchase"}
                </PrimaryButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
