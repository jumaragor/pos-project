"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PurchaseStatus, SupplierStatus } from "@prisma/client";
import { SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency, formatNumber } from "@/lib/format";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";
import type { PaginationState, PurchaseSummaryRow, SupplierOption } from "@/components/purchases/types";

type PurchaseStatusFilter = "ALL" | "DRAFT" | "POSTED" | "VOIDED";
type DateRangeFilter = "ALL" | "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM";
type PurchaseFilters = {
  supplierId: string;
  status: PurchaseStatusFilter;
  dateRange: DateRangeFilter;
  dateFrom: string;
  dateTo: string;
};

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function statusBadgeClass(status: PurchaseStatus, isVoided: boolean) {
  if (isVoided) return "badge inventory-status-out";
  return status === PurchaseStatus.POSTED ? "badge purchases-status-posted" : "badge purchases-status-draft";
}

function displayPurchaseStatus(status: PurchaseStatus, notes: string | null) {
  if (isVoidedPurchaseNote(notes)) return "VOIDED";
  return status;
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchasesScreen({
  initialPurchases,
  initialPagination
}: {
  initialPurchases: PurchaseSummaryRow[];
  initialPagination: PaginationState;
}) {
  const router = useRouter();
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
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const hasTriggeredListRefetch = useRef(false);

  const loadPurchases = useCallback(
    async (page = pagination.page, search = query) => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pagination.pageSize)
        });
        if (search.trim()) params.set("q", search.trim());
        if (filters.supplierId) params.set("supplierId", filters.supplierId);
        if (filters.status !== "ALL") params.set("status", filters.status);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        const response = await fetch(`/api/purchases?${params.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          items: PurchaseSummaryRow[];
          pagination: PaginationState;
        };
        setPurchases(payload.items);
        setPagination(payload.pagination);
      } finally {
        setLoadingList(false);
      }
    },
    [filters.dateFrom, filters.dateTo, filters.status, filters.supplierId, pagination.page, pagination.pageSize, query]
  );

  const currentRequestKey = JSON.stringify({
    page: 1,
    pageSize: pagination.pageSize,
    query: query.trim(),
    supplierId: filters.supplierId,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  });

  const initialRequestKey = JSON.stringify({
    page: 1,
    pageSize: initialPagination.pageSize,
    query: "",
    supplierId: "",
    status: "ALL",
    dateFrom: "",
    dateTo: ""
  });

  useEffect(() => {
    if (!hasTriggeredListRefetch.current && currentRequestKey === initialRequestKey) {
      return;
    }
    hasTriggeredListRefetch.current = true;
    const handle = window.setTimeout(() => {
      void loadPurchases(1, query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [currentRequestKey, filters.dateFrom, filters.dateTo, filters.status, filters.supplierId, initialRequestKey, loadPurchases, query]);

  useEffect(() => {
    let mounted = true;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    async function loadSupplierFilters() {
      const response = await fetch("/api/suppliers?activeOnly=true&pageSize=200");
      if (!response.ok) return;
      const payload = (await response.json()) as { items: SupplierOption[] };
      if (!mounted) return;
      setSuppliers(payload.items);
    }
    timeoutHandle = setTimeout(() => {
      void loadSupplierFilters();
    }, 150);
    return () => {
      mounted = false;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, []);

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

  const filterSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.status === SupplierStatus.ACTIVE),
    [suppliers]
  );

  return (
    <div className="grid purchases-screen">
      <div className="card">
        <div className="inventory-table-head">
          <h2 className="section-title">Purchases</h2>
          <Link href="/purchases/new" className="btn-primary purchases-new-btn">
            + New Purchase
          </Link>
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
                onChange={(event) => setFilters((prev) => ({ ...prev, supplierId: event.target.value }))}
              >
                <option value="">All suppliers</option>
                {filterSuppliers.map((supplier) => (
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
                  setFilters((prev) => ({ ...prev, status: event.target.value as PurchaseStatusFilter }))
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
                  onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                />
                <span className="muted">to</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
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
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={6} className="muted">Loading purchases...</td>
                </tr>
              ) : (
                purchases.map((purchase) => {
                  const isVoided = isVoidedPurchaseNote(purchase.notes);
                  return (
                    <tr
                      key={purchase.id}
                      className="purchases-clickable-row"
                      tabIndex={0}
                      role="link"
                      aria-label={`Open purchase ${purchase.purchaseNumber}`}
                      onClick={() => router.push(`/purchases/${purchase.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/purchases/${purchase.id}`);
                        }
                      }}
                    >
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
                    </tr>
                  );
                })
              )}
              {!loadingList && !purchases.length ? (
                <tr>
                  <td colSpan={6} className="muted">No purchases yet.</td>
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
            <span className="badge">Page {pagination.page} / {pagination.totalPages}</span>
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
    </div>
  );
}
