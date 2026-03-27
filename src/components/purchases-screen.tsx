"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PurchaseStatus, SupplierStatus } from "@prisma/client";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency, formatNumber } from "@/lib/format";
import { sanitizeDecimalInput, toNumber } from "@/lib/numeric-input";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";
import { useToast } from "@/components/toast-provider";
import { SearchIcon } from "@/components/ui/app-icons";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  unitCost: number;
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
type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type PurchaseStatusFilter = "ALL" | "DRAFT" | "POSTED" | "VOIDED";
type DateRangeFilter = "ALL" | "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM";
type PurchaseFilters = {
  supplierId: string;
  status: PurchaseStatusFilter;
  dateRange: DateRangeFilter;
  dateFrom: string;
  dateTo: string;
};

type SupplierOption = {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactPerson?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  status: SupplierStatus;
};

type ProductSearchState = {
  rowId: string | null;
  highlightedIndex: number;
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

function productOptionLabel(product: ProductOption) {
  return `${product.name} (${product.sku})`;
}

function supplierOptionLabel(supplier: SupplierOption) {
  return `${supplier.supplierName} (${supplier.supplierCode})`;
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

function asSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return formatCurrency(value);
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
  initialPagination
}: {
  initialPurchases: PurchaseRow[];
  initialPagination: PaginationState;
}) {
  const { success } = useToast();
  const [purchases, setPurchases] = useState(initialPurchases);
  const [pagination, setPagination] = useState(initialPagination);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PurchaseFilters>({
    supplierId: "",
    status: "ALL",
    dateRange: "ALL",
    dateFrom: "",
    dateTo: ""
  });
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<PurchaseStatus | null>(null);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierPickerQuery, setSupplierPickerQuery] = useState("");
  const [activePurchase, setActivePurchase] = useState<PurchaseRow | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [productSearchState, setProductSearchState] = useState<ProductSearchState>({
    rowId: null,
    highlightedIndex: 0
  });
  const [form, setForm] = useState<PurchaseForm>({
    purchaseDate: todayDateInput(),
    supplierId: "",
    referenceNumber: "",
    notes: "",
    status: PurchaseStatus.POSTED,
    items: []
  });
  const [productSearchByRow, setProductSearchByRow] = useState<Record<string, string>>({});

  const loadPurchases = useCallback(async (page = pagination.page, search = query) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize)
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (filters.supplierId) {
        params.set("supplierId", filters.supplierId);
      }
      if (filters.status !== "ALL") {
        params.set("status", filters.status);
      }
      if (filters.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set("dateTo", filters.dateTo);
      }
      const response = await fetch(`/api/purchases?${params.toString()}`);
      if (!response.ok) return;
      const payload = (await response.json()) as {
        items: PurchaseRow[];
        pagination: PaginationState;
      };
      setPurchases(payload.items);
      setPagination(payload.pagination);
    } finally {
      setLoadingList(false);
    }
  }, [filters.dateFrom, filters.dateTo, filters.status, filters.supplierId, pagination.page, pagination.pageSize, query]);

  const loadFormOptions = useCallback(async () => {
    if (products.length && suppliers.length) {
      return { products, suppliers };
    }
    setLoadingOptions(true);
    try {
      let nextProducts = products;
      let nextSuppliers = suppliers;
      const [productsResponse, suppliersResponse] = await Promise.all([
        fetch("/api/products?filter=active&pageSize=200"),
        fetch("/api/suppliers?activeOnly=true&pageSize=200")
      ]);
      if (productsResponse.ok) {
      const payload = (await productsResponse.json()) as { items: ProductOption[] };
      nextProducts = payload.items;
      setProducts(payload.items);
      }
      if (suppliersResponse.ok) {
        const payload = (await suppliersResponse.json()) as { items: SupplierOption[] };
        nextSuppliers = payload.items;
        setSuppliers(payload.items);
      }
      return { products: nextProducts, suppliers: nextSuppliers };
    } finally {
      setLoadingOptions(false);
    }
  }, [products, suppliers]);

  async function loadPurchaseDetail(id: string) {
    const response = await fetch(`/api/purchases/${id}`);
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error ?? "Failed to load purchase");
    }
    const purchase = (await response.json()) as PurchaseRow;
    return {
      ...purchase,
      totalItems: asSafeNumber(purchase.totalItems),
      totalCost: asSafeNumber(purchase.totalCost),
      items: purchase.items.map((item) => ({
        ...item,
        quantity: asSafeNumber(item.quantity),
        unitCost: asSafeNumber(item.unitCost),
        amount: asSafeNumber(item.amount),
        taxRate: asSafeNumber(item.taxRate),
        taxAmount: asSafeNumber(item.taxAmount),
        lineTotal: asSafeNumber(item.lineTotal)
      }))
    };
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadPurchases(1, query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [filters.dateFrom, filters.dateTo, filters.status, filters.supplierId, loadPurchases, query]);

  function updateDateRange(nextRange: DateRangeFilter) {
    const today = todayDateInput();
    const now = new Date();
    let nextFrom = "";
    let nextTo = "";

    if (nextRange === "TODAY") {
      nextFrom = today;
      nextTo = today;
    } else if (nextRange === "LAST_7_DAYS") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      nextFrom = start.toISOString().slice(0, 10);
      nextTo = today;
    } else if (nextRange === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      nextFrom = start.toISOString().slice(0, 10);
      nextTo = today;
    }

    setFilters((prev) => ({
      ...prev,
      dateRange: nextRange,
      dateFrom: nextRange === "CUSTOM" ? prev.dateFrom : nextFrom,
      dateTo: nextRange === "CUSTOM" ? prev.dateTo : nextTo
    }));
  }

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(filters.supplierId) ||
    filters.status !== "ALL" ||
    filters.dateRange !== "ALL" ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  useEffect(() => {
    async function loadSupplierFilters() {
      const response = await fetch("/api/suppliers?activeOnly=true&pageSize=200");
      if (!response.ok) return;
      const payload = (await response.json()) as { items: SupplierOption[] };
      setSuppliers(payload.items);
    }
    void loadSupplierFilters();
  }, []);

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

  async function openCreate() {
    const options = await loadFormOptions();
    const nextProducts = options?.products ?? products;
    const nextSuppliers = options?.suppliers ?? suppliers;
    const initialItems = nextProducts.length ? [emptyItem()] : [];
    const defaultSupplier = nextSuppliers.find((supplier) => supplier.status === SupplierStatus.ACTIVE);
    setFormMode("create");
    setActivePurchase(null);
    setForm({
      purchaseDate: todayDateInput(),
      supplierId: defaultSupplier?.id ?? "",
      referenceNumber: "",
      notes: "",
      status: PurchaseStatus.POSTED,
      items: initialItems
    });
    setProductSearchByRow(
      Object.fromEntries(initialItems.map((item) => [item.id, item.productName]))
    );
    setSupplierSearch(defaultSupplier ? supplierOptionLabel(defaultSupplier) : "");
    setSupplierPickerOpen(false);
    setSupplierPickerQuery("");
    setRemarksOpen(false);
    setOpen(true);
  }

  async function openEdit(purchase: PurchaseRow) {
    setLoadingDetail(true);
    try {
      const options = await loadFormOptions();
      const nextProducts = options?.products ?? products;
      const nextSuppliers = options?.suppliers ?? suppliers;
      const detail = await loadPurchaseDetail(purchase.id);
      setFormMode("edit");
      setActivePurchase(detail);
      setForm(makeFormFromPurchase(detail));
      const selectedSupplier = nextSuppliers.find((supplier) => supplier.id === detail.supplierId);
      setSupplierSearch(
        selectedSupplier
          ? supplierOptionLabel(selectedSupplier)
          : detail.supplierName ?? ""
      );
      setSupplierPickerOpen(false);
      setSupplierPickerQuery("");
      setRemarksOpen(Boolean(detail.notes?.trim()));
      setProductSearchByRow(
        Object.fromEntries(
          detail.items.map((item) => {
            const product = nextProducts.find((option) => option.id === item.productId);
            return [item.id, product ? productOptionLabel(product) : item.productName];
          })
        )
      );
      setOpen(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load purchase");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function openView(purchase: PurchaseRow) {
    setLoadingDetail(true);
    try {
      const options = await loadFormOptions();
      const nextProducts = options?.products ?? products;
      const nextSuppliers = options?.suppliers ?? suppliers;
      const detail = await loadPurchaseDetail(purchase.id);
      setFormMode("view");
      setActivePurchase(detail);
      setForm(makeFormFromPurchase(detail));
      const selectedSupplier = nextSuppliers.find((supplier) => supplier.id === detail.supplierId);
      setSupplierSearch(
        selectedSupplier
          ? supplierOptionLabel(selectedSupplier)
          : detail.supplierName ?? ""
      );
      setSupplierPickerOpen(false);
      setSupplierPickerQuery("");
      setRemarksOpen(Boolean(detail.notes?.trim()));
      setProductSearchByRow(
        Object.fromEntries(
          detail.items.map((item) => {
            const product = nextProducts.find((option) => option.id === item.productId);
            return [item.id, product ? productOptionLabel(product) : item.productName];
          })
        )
      );
      setOpen(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load purchase");
    } finally {
      setLoadingDetail(false);
    }
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
    const nextItem = emptyItem();
    setForm((prev) => ({ ...prev, items: [...prev.items, nextItem] }));
    setProductSearchByRow((prev) => ({
      ...prev,
      [nextItem.id]: ""
    }));
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

    const target = formMode === "edit" && activePurchase ? `/api/purchases/${activePurchase.id}` : "/api/purchases";
    const method = formMode === "edit" ? "PUT" : "POST";

    setSaving(true);
    setSaveAction(nextStatus);
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
      await loadPurchases(formMode === "create" ? 1 : pagination.page, query);
      success(
        nextStatus === PurchaseStatus.DRAFT
          ? "Changes saved successfully"
          : formMode === "edit"
            ? "Changes saved successfully"
            : "Purchase added successfully"
      );
    } finally {
      setSaving(false);
      setSaveAction(null);
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
    await loadPurchases(pagination.page, query);
    success("Deleted successfully");
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
    await loadPurchases(pagination.page, query);
    success("Process successful");
  }

  const readOnly = formMode === "view";
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.status === SupplierStatus.ACTIVE),
    [suppliers]
  );
  const filteredSupplierChoices = useMemo(() => {
    const search = supplierPickerQuery.trim().toLowerCase();
    if (!search) return activeSuppliers;
    return activeSuppliers.filter((supplier) =>
      [
        supplier.supplierName,
        supplier.contactPerson ?? "",
        supplier.mobileNumber ?? "",
        supplier.address ?? ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [activeSuppliers, supplierPickerQuery]);

  function openSupplierPicker() {
    if (readOnly) return;
    setSupplierPickerQuery("");
    setSupplierPickerOpen(true);
  }

  function selectSupplier(supplier: SupplierOption) {
    setForm((prev) => ({ ...prev, supplierId: supplier.id }));
    setSupplierSearch(supplierOptionLabel(supplier));
    setSupplierPickerOpen(false);
    setSupplierPickerQuery("");
  }

  function clearSupplierSelection() {
    setForm((prev) => ({ ...prev, supplierId: "" }));
    setSupplierSearch("");
  }

  function updateProductSearch(rowId: string, value: string) {
    setProductSearchByRow((prev) => ({ ...prev, [rowId]: value }));
    setProductSearchState({ rowId, highlightedIndex: 0 });
  }

  function getFilteredProducts(rowId: string) {
    const currentValue = (productSearchByRow[rowId] ?? "").trim().toLowerCase();
    const filtered = currentValue
      ? products.filter((product) =>
          [product.name, product.sku].join(" ").toLowerCase().includes(currentValue)
        )
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
      setProductSearchByRow((prev) => ({
        ...prev,
        [rowId]: productOptionLabel(product)
      }));
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

  return (
    <div className="grid purchases-screen">
      <div className="card">
        <div className="inventory-table-head">
          <h2 className="section-title">Purchases</h2>
          <PrimaryButton className="purchases-new-btn" onClick={openCreate} disabled={loadingDetail || loadingOptions}>
            {loadingOptions ? "Loading..." : "+ New Purchase"}
          </PrimaryButton>
        </div>

        <div className="purchases-toolbar">
          <div className="purchases-search-row">
            <input
              className="inventory-search"
              placeholder="Search purchases..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="purchases-filter-bar">
            <label className="form-field purchases-filter-field">
              <select
                value={filters.supplierId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, supplierId: event.target.value }))
                }
              >
                <option value="">All suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field purchases-filter-field">
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: event.target.value as PurchaseStatusFilter
                  }))
                }
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="POSTED">Posted</option>
                <option value="VOIDED">Voided</option>
              </select>
            </label>
            <label className="form-field purchases-filter-field">
              <select value={filters.dateRange} onChange={(event) => updateDateRange(event.target.value as DateRangeFilter)}>
                <option value="ALL">Date Range</option>
                <option value="TODAY">Today</option>
                <option value="LAST_7_DAYS">Last 7 days</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom range</option>
              </select>
            </label>
            {filters.dateRange === "CUSTOM" ? (
              <div className="purchases-custom-range">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                  }
                />
                <span className="muted">to</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                  }
                />
              </div>
            ) : null}
            {hasActiveFilters ? (
              <SecondaryButton
                type="button"
                className="purchases-clear-btn"
                onClick={() => {
                  setQuery("");
                  setFilters({
                    supplierId: "",
                    status: "ALL",
                    dateRange: "ALL",
                    dateFrom: "",
                    dateTo: ""
                  });
                }}
              >
                Clear
              </SecondaryButton>
            ) : null}
          </div>
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
              {loadingList ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Loading purchases...
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => {
                const isVoided = isVoidedPurchaseNote(purchase.notes);
                return (
                  <tr key={purchase.id}>
                    <td>{purchase.purchaseNumber}</td>
                    <td>{formatDate(purchase.purchaseDate)}</td>
                    <td>{purchase.supplierName || "-"}</td>
                    <td>{formatNumber(purchase.totalItems, { maximumFractionDigits: 3 })}</td>
                    <td>{formatCurrency(purchase.totalCost)}</td>
                    <td>
                      <span className={statusBadgeClass(purchase.status, isVoided)}>
                        {displayPurchaseStatus(purchase.status, purchase.notes)}
                      </span>
                    </td>
                    <td>
                      <div className="inventory-actions">
                        <button className="btn-info" onClick={() => void openView(purchase)} disabled={loadingDetail}>
                          View
                        </button>
                        {!isVoided && purchase.status === PurchaseStatus.DRAFT ? (
                          <button className="btn-secondary" onClick={() => void openEdit(purchase)} disabled={loadingDetail}>
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
              }))}
              {!loadingList && !purchases.length ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No purchases yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="inventory-pagination">
          <div>
            Showing {purchases.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0} to{" "}
            {(pagination.page - 1) * pagination.pageSize + purchases.length} of {pagination.total}
          </div>
          <div className="row">
            <button
              className="btn-secondary"
              disabled={pagination.page <= 1 || loadingList}
              onClick={() => void loadPurchases(pagination.page - 1, query)}
            >
              Prev
            </button>
            <span className="badge">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={pagination.page >= pagination.totalPages || loadingList}
              onClick={() => void loadPurchases(pagination.page + 1, query)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal purchases-modal purchases-dialog">
            <div className="inventory-modal-header purchases-dialog-header">
              <div>
                <h3 className="section-title">
                  {formMode === "create"
                    ? "New Purchase"
                    : formMode === "edit"
                      ? "Edit Draft Purchase"
                      : "View Purchase"}
                </h3>
              </div>
            </div>

            <div className="inventory-modal-body purchases-dialog-body">
              {loadingOptions ? <div className="muted">Loading purchase form options...</div> : null}

              <section className="purchases-section">
                <div className="purchases-section-head">
                  <h4 className="section-title">Header</h4>
                </div>
                <div className="grid grid-2 purchases-header-grid">
                  <div className="form-field">
                    <label className="field-label">Supplier</label>
                    <div className="purchases-supplier-search">
                      <SearchIcon className="purchases-supplier-search-icon" />
                      <input
                        placeholder="Select supplier"
                        value={supplierSearch}
                        readOnly
                        onClick={openSupplierPicker}
                      />
                    </div>
                    {!readOnly && supplierSearch ? (
                      <button
                        type="button"
                        className="purchases-supplier-link"
                        onClick={clearSupplierSelection}
                      >
                        Clear supplier
                      </button>
                    ) : null}
                  </div>
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
                    <label className="field-label">Reference No.</label>
                    <input
                      placeholder="Reference number"
                      value={form.referenceNumber}
                      disabled={readOnly}
                      onChange={(event) => setForm((prev) => ({ ...prev, referenceNumber: event.target.value }))}
                    />
                  </div>
                </div>
              </section>

              <section className="purchases-section">
                <div className="row purchases-items-header">
                  <h4 className="section-title">Line Items</h4>
                  {!readOnly ? (
                    <SecondaryButton type="button" className="purchases-add-item-btn" onClick={addItemRow}>
                      + Add Item
                    </SecondaryButton>
                  ) : null}
                </div>
                <div className="table-wrap purchases-items-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Total</th>
                        {!readOnly ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {readOnly ? (
                              <input readOnly className="purchases-computed-input" value={item.productName} />
                            ) : (
                              <div
                                className={`purchases-product-search ${
                                  productSearchState.rowId === item.id ? "active" : ""
                                }`}
                              >
                                <SearchIcon className="purchases-product-search-icon" />
                                <input
                                  placeholder="Search product by name or SKU"
                                  value={productSearchByRow[item.id] ?? ""}
                                  onChange={(event) => updateProductSearch(item.id, event.target.value)}
                                  onFocus={() => setProductSearchState({ rowId: item.id, highlightedIndex: 0 })}
                                  onBlur={() => validateProductSearch(item.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      const results = getFilteredProducts(item.id);
                                      const highlighted =
                                        results[
                                          Math.min(productSearchState.highlightedIndex, Math.max(results.length - 1, 0))
                                        ];
                                      if (highlighted) {
                                        selectProduct(item.id, highlighted);
                                      }
                                    }
                                    if (event.key === "ArrowDown") {
                                      event.preventDefault();
                                      const results = getFilteredProducts(item.id);
                                      setProductSearchState((prev) => ({
                                        rowId: item.id,
                                        highlightedIndex: Math.min(
                                          prev.rowId === item.id ? prev.highlightedIndex + 1 : 0,
                                          Math.max(results.length - 1, 0)
                                        )
                                      }));
                                    }
                                    if (event.key === "ArrowUp") {
                                      event.preventDefault();
                                      setProductSearchState((prev) => ({
                                        rowId: item.id,
                                        highlightedIndex: Math.max(
                                          (prev.rowId === item.id ? prev.highlightedIndex : 0) - 1,
                                          0
                                        )
                                      }));
                                    }
                                  }}
                                />
                                {productSearchByRow[item.id] ? (
                                  <button
                                    type="button"
                                    className="purchases-product-clear-btn"
                                    onClick={() => clearProductSelection(item.id)}
                                    aria-label="Clear product"
                                  >
                                    ×
                                  </button>
                                ) : null}
                                {productSearchState.rowId === item.id ? (
                                  <div className="purchases-product-results">
                                    {getFilteredProducts(item.id).length ? (
                                      getFilteredProducts(item.id).map((product, index) => (
                                        <button
                                          key={product.id}
                                          type="button"
                                          className={`purchases-product-result ${
                                            index === productSearchState.highlightedIndex ? "active" : ""
                                          }`}
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            selectProduct(item.id, product);
                                          }}
                                        >
                                          <span className="purchases-product-result-main">
                                            {product.name}
                                          </span>
                                          <span className="purchases-product-result-meta">
                                            {product.sku}
                                          </span>
                                          <span className="purchases-product-result-cost">
                                            Last cost: {formatMoney(product.unitCost)}
                                          </span>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="purchases-product-empty">No matching products found.</div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}
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
                              readOnly
                              className="purchases-computed-input"
                              value={formatMoney(item.amount)}
                            />
                          </td>
                          {!readOnly ? (
                            <td>
                              <button className="btn-danger purchases-remove-btn" onClick={() => removeItemRow(item.id)}>
                                Remove
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card purchases-summary purchases-summary-card">
                <div className="purchases-summary-head">
                  <h4 className="section-title">Summary</h4>
                  <span className="muted">{formatNumber(summary.totalItems)} item(s)</span>
                </div>
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(summary.subtotal)}</strong>
                </div>
                <div>
                  <span>Tax</span>
                  <strong>{formatMoney(summary.totalTax)}</strong>
                </div>
                <div className="purchases-summary-grand">
                  <span>Grand Total</span>
                  <strong>{formatMoney(summary.grandTotal)}</strong>
                </div>
              </section>

              {readOnly || remarksOpen || form.notes.trim() ? (
                <section className="purchases-section purchases-remarks-section">
                  <button
                    type="button"
                    className="purchases-remarks-toggle"
                    onClick={() => setRemarksOpen((prev) => !prev)}
                  >
                    {remarksOpen ? "Hide Remarks" : "+ Add Remarks"}
                  </button>
                  {remarksOpen ? (
                    <div className="form-field">
                      <label className="field-label">Remarks</label>
                      <textarea
                        rows={3}
                        placeholder="Optional remarks"
                        value={form.notes}
                        disabled={readOnly}
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </div>
                  ) : null}
                </section>
              ) : (
                <section className="purchases-section purchases-remarks-section">
                  <button
                    type="button"
                    className="purchases-remarks-toggle"
                    onClick={() => setRemarksOpen(true)}
                  >
                    + Add Remarks
                  </button>
                </section>
              )}
            </div>

            <div className="inventory-modal-footer purchases-dialog-footer">
              <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
              {!readOnly ? (
                <>
                  <SecondaryButton onClick={() => void savePurchase(PurchaseStatus.DRAFT)} disabled={saving}>
                    {saving && saveAction === PurchaseStatus.DRAFT ? "Saving..." : "Save Draft"}
                  </SecondaryButton>
                  <PrimaryButton onClick={() => void savePurchase(PurchaseStatus.POSTED)} disabled={saving}>
                    {saving && saveAction === PurchaseStatus.POSTED ? "Posting..." : "Post Purchase"}
                  </PrimaryButton>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {supplierPickerOpen ? (
        <div className="inventory-modal-overlay">
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
                        <tr
                          key={supplier.id}
                          className="purchases-supplier-row"
                          onClick={() => selectSupplier(supplier)}
                        >
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
                        <td colSpan={5} className="muted">
                          No active suppliers found.
                        </td>
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
