"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PurchaseStatus, SupplierStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { SearchIcon } from "@/components/ui/app-icons";
import { PurchaseDetailActions } from "@/components/purchase-detail-actions";
import { useToast } from "@/components/toast-provider";
import { formatCurrency, formatNumber } from "@/lib/format";
import { sanitizeDecimalInput, toNumber } from "@/lib/numeric-input";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";
import type {
  ProductOption,
  PurchaseDetailRow,
  PurchaseItemRow,
  SupplierOption
} from "@/components/purchases/types";

type PurchaseEntryOptions = {
  products: ProductOption[];
  suppliers: SupplierOption[];
};

let purchaseEntryOptionsCache: PurchaseEntryOptions | null = null;
let purchaseEntryOptionsPromise: Promise<PurchaseEntryOptions> | null = null;

type ProductSearchState = {
  rowId: string | null;
  highlightedIndex: number;
};

type PurchaseForm = {
  purchaseDate: string;
  supplierId: string;
  referenceNumber: string;
  notes: string;
  status: PurchaseStatus;
  items: PurchaseItemRow[];
};

function emptyItem(): PurchaseItemRow {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
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

function supplierOptionLabel(supplier: SupplierOption) {
  return `${supplier.supplierName} (${supplier.supplierCode})`;
}

function productOptionLabel(product: ProductOption) {
  return product.name;
}

function purchaseStatusBadgeClass(status: PurchaseStatus, isVoided: boolean) {
  if (isVoided) return "badge inventory-status-out";
  return status === PurchaseStatus.POSTED ? "badge purchases-status-posted" : "badge purchases-status-draft";
}

function displayPurchaseStatus(status: PurchaseStatus, isVoided: boolean) {
  if (isVoided) return "VOIDED";
  return status;
}

function toDateInput(isoDate: string) {
  return new Date(isoDate).toISOString().slice(0, 10);
}

async function loadPurchaseEntryOptions() {
  if (purchaseEntryOptionsCache) {
    return purchaseEntryOptionsCache;
  }

  if (!purchaseEntryOptionsPromise) {
    purchaseEntryOptionsPromise = Promise.all([
      fetch("/api/products?filter=all&all=true&sortKey=name&sortDir=asc&mode=lookup"),
      fetch("/api/suppliers?activeOnly=true&all=true")
    ]).then(async ([productsResponse, suppliersResponse]) => {
      const [productsPayload, suppliersPayload] = await Promise.all([
        productsResponse.ok
          ? (productsResponse.json() as Promise<{ items: ProductOption[] }>)
          : Promise.resolve({ items: [] as ProductOption[] }),
        suppliersResponse.ok
          ? (suppliersResponse.json() as Promise<{ items: SupplierOption[] }>)
          : Promise.resolve({ items: [] as SupplierOption[] })
      ]);

      const nextOptions = {
        products: productsPayload.items,
        suppliers: suppliersPayload.items
      };

      purchaseEntryOptionsCache = nextOptions;
      purchaseEntryOptionsPromise = null;
      return nextOptions;
    }).catch((error) => {
      purchaseEntryOptionsPromise = null;
      throw error;
    });
  }

  return purchaseEntryOptionsPromise;
}

function makeFormFromPurchase(purchase: PurchaseDetailRow): PurchaseForm {
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

export function PurchaseEntryScreen({
  mode,
  initialPurchase
}: {
  mode: "create" | "edit" | "view";
  initialPurchase?: PurchaseDetailRow;
}) {
  const router = useRouter();
  const { success } = useToast();
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const canEdit = !isViewMode;
  const initialForm = useMemo(
    () =>
      initialPurchase
        ? makeFormFromPurchase(initialPurchase)
        : {
            purchaseDate: todayDateInput(),
            supplierId: "",
            referenceNumber: "",
            notes: "",
            status: PurchaseStatus.POSTED,
            items: [emptyItem()]
          },
    [initialPurchase]
  );
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<PurchaseStatus | null>(null);
  const [persistedPurchaseId, setPersistedPurchaseId] = useState<string | null>(initialPurchase?.id ?? null);
  const [remarksOpen] = useState(mode !== "create" ? Boolean(initialPurchase?.notes?.trim()) : false);
  const [supplierSearch, setSupplierSearch] = useState(initialPurchase?.supplierName ?? "");
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierPickerQuery, setSupplierPickerQuery] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [productSearchState, setProductSearchState] = useState<ProductSearchState>({
    rowId: null,
    highlightedIndex: 0
  });
  const [form, setForm] = useState<PurchaseForm>(
    initialForm
  );
  const [productSearchByRow, setProductSearchByRow] = useState<Record<string, string>>(
    initialPurchase
      ? Object.fromEntries(initialForm.items.map((item) => [item.id, item.productName]))
      : {}
  );

  useEffect(() => {
    let mounted = true;

    function applyLoadedOptions({ products: loadedProducts, suppliers: loadedSuppliers }: PurchaseEntryOptions) {
      setProducts(loadedProducts);
      setSuppliers(loadedSuppliers);

      if (isEditMode && initialPurchase) {
        setProductSearchByRow(
          Object.fromEntries(
            initialForm.items.map((item) => {
              const product = loadedProducts.find((option) => option.id === item.productId);
              return [item.id, product ? productOptionLabel(product) : item.productName];
            })
          )
        );
      }

      if (mode === "create") {
        setForm((prev) => ({
          ...prev,
          supplierId: prev.supplierId || ""
        }));
        setSupplierSearch((prev) => prev || "");
      } else if (initialPurchase?.supplierId) {
        const selectedSupplier = loadedSuppliers.find((supplier) => supplier.id === initialPurchase.supplierId);
        setSupplierSearch(selectedSupplier ? supplierOptionLabel(selectedSupplier) : initialPurchase.supplierName ?? "");
      }
    }

    async function fetchOptions() {
      if (!purchaseEntryOptionsCache) {
        setLoadingOptions(true);
      }
      try {
        const nextOptions = await loadPurchaseEntryOptions();
        if (!mounted) return;
        applyLoadedOptions(nextOptions);
      } finally {
        if (mounted) {
          setLoadingOptions(false);
        }
      }
    }

    if (canEdit) {
      if (purchaseEntryOptionsCache) {
        applyLoadedOptions(purchaseEntryOptionsCache);
        setLoadingOptions(false);
      } else {
        void fetchOptions();
      }
    }

    return () => {
      mounted = false;
    };
  }, [canEdit, initialForm.items, initialPurchase, isEditMode, mode]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const existingPurchaseId = persistedPurchaseId ?? initialPurchase?.id ?? null;
  const isPersistedPurchase = Boolean(existingPurchaseId);
  const displayedStatus = mode === "create" ? PurchaseStatus.DRAFT : initialPurchase?.status ?? PurchaseStatus.DRAFT;
  const isVoided = isVoidedPurchaseNote(initialPurchase?.notes);

  const searchableProducts = useMemo(
    () =>
      products.map((product) => ({
        product,
        haystack: [product.name, product.sku, product.description ?? ""].join(" ").toLowerCase()
      })),
    [products]
  );

  const summary = useMemo(() => {
    const totalItems = form.items.length;
    const subtotal = form.items.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = form.items.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = form.items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { totalItems, subtotal, totalTax, grandTotal };
  }, [form.items]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.status === SupplierStatus.ACTIVE),
    [suppliers]
  );

  const filteredSupplierChoices = useMemo(() => {
    const search = supplierPickerQuery.trim().toLowerCase();
    if (!search) return activeSuppliers;
    return activeSuppliers.filter((supplier) =>
      [supplier.supplierName, supplier.contactPerson ?? "", supplier.mobileNumber ?? "", supplier.address ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [activeSuppliers, supplierPickerQuery]);

  function updateItem(
    itemId: string,
    next: Partial<{
      productId: string;
      quantity: number;
      unitCost: number;
      taxRate: number;
    }>
  ) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const selectedProduct =
          typeof next.productId === "string" ? productById.get(next.productId) ?? null : null;
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
      })
    }));
  }

  function addItemRow() {
    const nextItem = emptyItem();
    setForm((prev) => ({ ...prev, items: [...prev.items, nextItem] }));
    setProductSearchByRow((prev) => ({ ...prev, [nextItem.id]: "" }));
  }

  function removeItemRow(itemId: string) {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((item) => item.id !== itemId) };
    });
    setProductSearchByRow((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function updateProductSearch(rowId: string, value: string) {
    setProductSearchByRow((prev) => ({ ...prev, [rowId]: value }));
    setProductSearchState({ rowId, highlightedIndex: 0 });
  }

  function getFilteredProducts(rowId: string) {
    const currentValue = (productSearchByRow[rowId] ?? "").trim().toLowerCase();
    const filtered = currentValue
      ? searchableProducts.filter((entry) => entry.haystack.includes(currentValue)).map((entry) => entry.product)
      : products;
    return filtered.slice(0, 8);
  }

  function selectProduct(rowId: string, product: ProductOption) {
    const duplicateRow = form.items.find((item) => item.id !== rowId && item.productId === product.id);
    if (duplicateRow) {
      updateItem(duplicateRow.id, { quantity: duplicateRow.quantity + 1 });
      removeItemRow(rowId);
    } else {
      updateItem(rowId, {
        productId: product.id,
        quantity: 1,
        unitCost: product.unitCost
      });
      setProductSearchByRow((prev) => ({ ...prev, [rowId]: productOptionLabel(product) }));
    }
    setProductSearchState({ rowId: null, highlightedIndex: 0 });
    const isLastRow = form.items[form.items.length - 1]?.id === rowId;
    if (isLastRow) {
      addItemRow();
    }
  }

  function clearProductSelection(rowId: string) {
    setProductSearchByRow((prev) => ({ ...prev, [rowId]: "" }));
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === rowId
          ? {
              ...item,
              productId: "",
              productName: "",
              quantity: 1,
              unitCost: 0,
              amount: 0,
              taxAmount: 0,
              lineTotal: 0
            }
          : item
      )
    }));
  }

  function validateProductSearch(rowId: string) {
    const currentValue = (productSearchByRow[rowId] ?? "").trim();
    const currentRow = form.items.find((item) => item.id === rowId);
    const matchedProduct = products.find((product) => productOptionLabel(product) === currentValue);
    if (matchedProduct && currentRow?.productId !== matchedProduct.id) {
      selectProduct(rowId, matchedProduct);
      return;
    }
    if (matchedProduct && currentRow?.productId === matchedProduct.id) {
      setProductSearchState({ rowId: null, highlightedIndex: 0 });
      return;
    }
    if (!currentValue) {
      clearProductSelection(rowId);
    }
    setProductSearchState((prev) => (prev.rowId === rowId ? { rowId: null, highlightedIndex: 0 } : prev));
  }

  function openSupplierPicker() {
    if (!canEdit) return;
    setSupplierPickerQuery("");
    setSupplierPickerOpen(true);
  }

  function selectSupplier(supplier: SupplierOption) {
    setForm((prev) => ({ ...prev, supplierId: supplier.id }));
    setSupplierSearch(supplierOptionLabel(supplier));
    setSupplierPickerOpen(false);
    setSupplierPickerQuery("");
  }

  async function savePurchase(nextStatus: PurchaseStatus) {
    if (!form.purchaseDate) {
      alert("Purchase date is required");
      return;
    }
    if (form.items.some((item) => !item.productId)) {
      alert("Please select a valid product for each line item");
      return;
    }
    if (
      !form.items.length ||
      form.items.some((item) => !item.productId || item.quantity <= 0 || item.unitCost < 0 || item.taxRate < 0)
    ) {
      alert("Please provide valid purchase items");
      return;
    }

    const payload = {
      purchaseDate: form.purchaseDate,
      supplierId: form.supplierId || null,
      referenceNumber: form.referenceNumber,
      notes: form.notes,
      status: nextStatus,
      items: form.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        amount: item.amount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount
      }))
    };

    const target = existingPurchaseId ? `/api/purchases/${existingPurchaseId}` : "/api/purchases";
    const method = existingPurchaseId ? "PUT" : "POST";

    setSaving(true);
    setSaveAction(nextStatus);
    try {
      const response = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error ?? "Failed to save purchase");
        return;
      }
      if (typeof result.id === "string" && result.id) {
        setPersistedPurchaseId(result.id);
      }
      setForm((prev) => ({
        ...prev,
        referenceNumber: typeof result.referenceNumber === "string" ? result.referenceNumber : prev.referenceNumber
      }));
      success(
        nextStatus === PurchaseStatus.DRAFT
          ? "Changes saved successfully"
          : isPersistedPurchase
            ? "Changes saved successfully"
            : "Purchase added successfully"
      );
      if (nextStatus === PurchaseStatus.DRAFT) {
        router.push(`/purchases/${result.id}/edit`);
      } else {
        router.push(`/purchases/${result.id}`);
      }
      router.refresh();
    } finally {
      setSaving(false);
      setSaveAction(null);
    }
  }

  return (
    <div className="grid purchases-page-shell">
      <div className="card purchases-workspace-card">
        <div className="purchases-page-head">
          <div className="purchases-page-head-copy">
            <Link href="/purchases" className="purchases-page-title-link">
              <h2 className="section-title">Purchases</h2>
            </Link>
          </div>
          {isViewMode && initialPurchase ? (
            <PurchaseDetailActions purchaseId={initialPurchase.id} status={initialPurchase.status} isVoided={isVoided} />
          ) : null}
        </div>

        <div className="purchases-top-grid">
          <section className="purchases-section purchases-header-section card purchase-detail-card">
            <div className="purchases-header-grid">
              <div className="form-field purchases-header-reference">
                <label className="field-label">Reference No.</label>
                <input
                  value={form.referenceNumber}
                  readOnly
                />
              </div>
              <div className="form-field purchases-header-supplier">
                <label className="field-label">Supplier</label>
                <div className="purchases-supplier-search">
                  <SearchIcon className="purchases-supplier-search-icon" />
                  <input placeholder="Select supplier" value={supplierSearch} readOnly onClick={openSupplierPicker} />
                </div>
              </div>
              <div className="form-field purchases-header-date">
                <label className="field-label">Purchase Date</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  readOnly={isViewMode}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchaseDate: event.target.value }))}
                />
              </div>
              <div className="purchases-header-status">
                <span className="field-label purchases-header-status-label">Status</span>
                <div className="purchases-header-status-value">
                  <span className={purchaseStatusBadgeClass(displayedStatus, isVoided)}>
                    {displayPurchaseStatus(displayedStatus, isVoided)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="card purchases-summary purchases-summary-card">
            <div className="purchases-summary-head">
              <div className="purchases-summary-head-copy">
                <h3 className="section-title">Summary</h3>
              </div>
            </div>
            <div>
              <span>Item(s)</span>
              <strong>{formatNumber(summary.totalItems)}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{summary.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{summary.totalTax.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <div className="purchases-summary-grand">
              <span>Grand Total</span>
              <strong>{formatCurrency(summary.grandTotal)}</strong>
            </div>
          </section>
        </div>

        <section className="purchases-section">
          <div className="row purchases-items-header">
            <h3 className="section-title">Line Items</h3>
            {canEdit ? (
              <SecondaryButton type="button" className="purchases-add-item-btn" onClick={addItemRow}>
                + Add Item
              </SecondaryButton>
            ) : null}
          </div>
          <div className="table-wrap purchases-items-table purchases-items-table-page">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                  {canEdit ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item) => {
                  const filteredProducts =
                    productSearchState.rowId === item.id ? getFilteredProducts(item.id) : [];
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={`purchases-product-search ${productSearchState.rowId === item.id ? "active" : ""}`}>
                          <SearchIcon className="purchases-product-search-icon" />
                          <input
                            placeholder="Search product by name or SKU"
                            value={productSearchByRow[item.id] ?? ""}
                            readOnly={isViewMode}
                            onChange={canEdit ? (event) => updateProductSearch(item.id, event.target.value) : undefined}
                            onFocus={canEdit ? () => setProductSearchState({ rowId: item.id, highlightedIndex: 0 }) : undefined}
                            onBlur={canEdit ? () => validateProductSearch(item.id) : undefined}
                            onKeyDown={(event) => {
                              if (!canEdit) return;
                              if (event.key === "Enter") {
                                event.preventDefault();
                                const highlighted =
                                  filteredProducts[
                                    Math.min(productSearchState.highlightedIndex, Math.max(filteredProducts.length - 1, 0))
                                  ];
                                if (highlighted) {
                                  selectProduct(item.id, highlighted);
                                }
                              }
                              if (event.key === "ArrowDown") {
                                event.preventDefault();
                                setProductSearchState((prev) => ({
                                  rowId: item.id,
                                  highlightedIndex: Math.min(
                                    prev.rowId === item.id ? prev.highlightedIndex + 1 : 0,
                                    Math.max(filteredProducts.length - 1, 0)
                                  )
                                }));
                              }
                              if (event.key === "ArrowUp") {
                                event.preventDefault();
                                setProductSearchState((prev) => ({
                                  rowId: item.id,
                                  highlightedIndex: Math.max((prev.rowId === item.id ? prev.highlightedIndex : 0) - 1, 0)
                                }));
                              }
                            }}
                          />
                          {false ? (
                            <button
                              type="button"
                              className="purchases-product-clear-btn"
                              onClick={() => clearProductSelection(item.id)}
                              aria-label="Clear product"
                            >
                              ×
                            </button>
                          ) : null}
                          {canEdit && productSearchState.rowId === item.id ? (
                            <div className="purchases-product-results">
                              {filteredProducts.length ? (
                                filteredProducts.map((product, index) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    className={`purchases-product-result ${index === productSearchState.highlightedIndex ? "active" : ""}`}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      selectProduct(item.id, product);
                                    }}
                                  >
                                    <span className="purchases-product-result-main">{product.name}</span>
                                    <span className="purchases-product-result-meta">{product.sku}</span>
                                    <span className="purchases-product-result-cost">
                                      Last cost: {formatCurrency(product.unitCost)}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="purchases-product-empty">
                                  {loadingOptions ? "Loading products..." : "No matching products found."}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*[.]?[0-9]*"
                          value={item.quantity.toString()}
                          readOnly={isViewMode}
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
                          value={item.unitCost.toString()}
                          readOnly={isViewMode}
                          onChange={(event) => {
                            const next = sanitizeDecimalInput(event.target.value);
                            updateItem(item.id, { unitCost: toNumber(next) });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          readOnly
                          className="purchases-computed-input"
                          value={formatCurrency(isViewMode ? item.lineTotal : item.amount)}
                        />
                      </td>
                      {canEdit ? (
                        <td>
                          <button className="btn-danger purchases-remove-btn" onClick={() => removeItemRow(item.id)}>
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {canEdit ? (
          <section className="purchases-bottom-section">
            {remarksOpen || form.notes.trim() ? (
              <div className="purchases-section purchases-remarks-section">
                <div className="form-field">
                  <label className="field-label">Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="Optional remarks"
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
              </div>
            ) : null}

            <div className="inventory-modal-footer purchases-page-footer">
              <Link href="/purchases" className="btn-secondary">
                Cancel
              </Link>
              <SecondaryButton onClick={() => void savePurchase(PurchaseStatus.DRAFT)} disabled={saving}>
                <span className="purchases-action-content">
                  <span
                    aria-hidden="true"
                    className={
                      saving && saveAction === PurchaseStatus.DRAFT
                        ? "purchases-action-spinner purchases-action-spinner-secondary is-active"
                        : "purchases-action-spinner purchases-action-spinner-secondary"
                    }
                  />
                  <span
                    className={
                      saving && saveAction === PurchaseStatus.DRAFT
                        ? "purchases-action-label is-hidden"
                        : "purchases-action-label"
                    }
                  >
                    Save
                  </span>
                </span>
              </SecondaryButton>
              <PrimaryButton onClick={() => void savePurchase(PurchaseStatus.POSTED)} disabled={saving}>
                <span className="purchases-action-content">
                  <span
                    aria-hidden="true"
                    className={
                      saving && saveAction === PurchaseStatus.POSTED
                        ? "purchases-action-spinner purchases-action-spinner-primary is-active"
                        : "purchases-action-spinner purchases-action-spinner-primary"
                    }
                  />
                  <span
                    className={
                      saving && saveAction === PurchaseStatus.POSTED
                        ? "purchases-action-label is-hidden"
                        : "purchases-action-label"
                    }
                  >
                    Post
                  </span>
                </span>
              </PrimaryButton>
            </div>
          </section>
        ) : form.notes.trim() ? (
          <section className="purchase-detail-card">
            <h3 className="section-title">Remarks</h3>
            <div className="purchase-detail-notes">{form.notes}</div>
          </section>
        ) : null}
      </div>

      {canEdit && supplierPickerOpen ? (
        <div className="inventory-modal-overlay purchases-modal-overlay">
          <div className="inventory-modal purchases-supplier-picker">
            <div className="inventory-modal-header">
              <h3 className="section-title">Select Supplier</h3>
            </div>
            <div className="inventory-modal-body purchases-supplier-picker-body">
              <input
                className="inventory-search"
                placeholder="Search supplier..."
                value={supplierPickerQuery}
                onChange={(event) => setSupplierPickerQuery(event.target.value)}
                autoFocus
              />
              <div className="table-wrap purchases-supplier-picker-table">
                <table>
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Contact Person</th>
                      <th>Contact Number</th>
                      <th>Address</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplierChoices.length ? (
                      filteredSupplierChoices.map((supplier) => (
                        <tr key={supplier.id} className="purchases-supplier-row" onClick={() => selectSupplier(supplier)}>
                          <td>{supplier.supplierName}</td>
                          <td>{supplier.contactPerson || "-"}</td>
                          <td>{supplier.mobileNumber || "-"}</td>
                          <td>{supplier.address || "-"}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectSupplier(supplier);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="muted">No active suppliers found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="inventory-modal-footer">
              <SecondaryButton onClick={() => setSupplierPickerOpen(false)}>Close</SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
