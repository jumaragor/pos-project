"use client";

import { ExpensePaymentMethod, ExpenseStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ExpensesIcon } from "@/components/ui/app-icons";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/toast-provider";

type ExpenseCategoryRow = {
  id: string;
  name: string;
  isActive: boolean;
};

type ExpenseRow = {
  id: string;
  expenseNo: string;
  date: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
  };
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod | null;
  paidTo: string | null;
  referenceNo: string | null;
  remarks: string | null;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
};

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ExpenseSummary = {
  totalExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  cancelledExpenses: number;
};

type ExpenseForm = {
  date: string;
  categoryId: string;
  description: string;
  amount: string;
  paymentMethod: ExpensePaymentMethod | "";
  paidTo: string;
  referenceNo: string;
  remarks: string;
  status: ExpenseStatus;
};

type ExpenseFilters = {
  query: string;
  categoryId: string;
  status: ExpenseStatus | "ALL";
  paymentMethod: ExpensePaymentMethod | "ALL";
  dateFrom: string;
  dateTo: string;
};

type FormMode = "create" | "edit";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): ExpenseForm {
  return {
    date: todayInput(),
    categoryId: "",
    description: "",
    amount: "",
    paymentMethod: ExpensePaymentMethod.CASH,
    paidTo: "",
    referenceNo: "",
    remarks: "",
    status: ExpenseStatus.PAID
  };
}

function formatExpenseDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatExpenseStatus(status: ExpenseStatus) {
  switch (status) {
    case ExpenseStatus.PAID:
      return "Paid";
    case ExpenseStatus.PENDING:
      return "Pending";
    case ExpenseStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
}

function paymentMethodLabel(value: ExpensePaymentMethod | null) {
  return value ? value.replaceAll("_", " ") : "-";
}

export function ExpensesScreen({
  initialExpenses,
  initialPagination,
  initialSummary,
  initialCategories,
  paymentMethodOptions
}: {
  initialExpenses: ExpenseRow[];
  initialPagination: PaginationState;
  initialSummary: ExpenseSummary;
  initialCategories: ExpenseCategoryRow[];
  statusOptions: ExpenseStatus[];
  paymentMethodOptions: ExpensePaymentMethod[];
}) {
  const { data: session } = useSession();
  const { success } = useToast();
  const canManage = session?.user.role === "OWNER" || session?.user.role === "MANAGER";
  const [expenses, setExpenses] = useState(initialExpenses);
  const [pagination, setPagination] = useState(initialPagination);
  const [summary, setSummary] = useState(initialSummary);
  const [categories, setCategories] = useState(initialCategories);
  const [filters, setFilters] = useState<ExpenseFilters>({
    query: "",
    categoryId: "",
    status: "ALL",
    paymentMethod: "ALL",
    dateFrom: "",
    dateTo: ""
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeExpenseId, setActiveExpenseId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<ExpenseForm>(emptyForm());

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  );
  const showingFrom = expenses.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const showingTo = (pagination.page - 1) * pagination.pageSize + expenses.length;

  const loadExpenses = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pagination.pageSize)
        });
        if (filters.query.trim()) params.set("q", filters.query.trim());
        if (filters.categoryId) params.set("categoryId", filters.categoryId);
        if (filters.status !== "ALL") params.set("status", filters.status);
        if (filters.paymentMethod !== "ALL") params.set("paymentMethod", filters.paymentMethod);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);

        const response = await fetch(`/api/expenses?${params.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          items: ExpenseRow[];
          pagination: PaginationState;
          summary: ExpenseSummary;
        };
        setExpenses(payload.items);
        setPagination(payload.pagination);
        setSummary(payload.summary);
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.pageSize]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadExpenses(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters, loadExpenses]);

  async function refreshCategories() {
    const response = await fetch("/api/expense-categories");
    if (!response.ok) return categories;
    const payload = (await response.json()) as { items: ExpenseCategoryRow[] };
    setCategories(payload.items);
    return payload.items;
  }

  async function openCreate() {
    const freshCategories = await refreshCategories();
    const availableCategories = freshCategories.filter((category) => category.isActive);
    const nextForm = emptyForm();
    if (availableCategories[0]) {
      nextForm.categoryId = availableCategories[0].id;
    }
    setFormMode("create");
    setActiveExpenseId(null);
    setForm(nextForm);
    setOpen(true);
  }

  async function openEdit(expenseId: string) {
    const response = await fetch(`/api/expenses/${expenseId}`);
    const payload = await response.json();
    if (!response.ok) {
      alert(payload.error ?? "Failed to load expense");
      return;
    }
    await refreshCategories();
    setFormMode("edit");
    setActiveExpenseId(payload.id);
    setForm({
      date: String(payload.date).slice(0, 10),
      categoryId: payload.categoryId,
      description: payload.description ?? "",
      amount: String(payload.amount ?? ""),
      paymentMethod: payload.paymentMethod ?? "",
      paidTo: payload.paidTo ?? "",
      referenceNo: payload.referenceNo ?? "",
      remarks: payload.remarks ?? "",
      status: payload.status
    });
    setOpen(true);
  }

  async function submitForm() {
    if (!form.date || !form.categoryId || !form.description.trim() || !form.amount) {
      alert("Date, category, description, and amount are required.");
      return;
    }
    if (Number(form.amount) <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }
    if (form.status === ExpenseStatus.PAID && !form.paymentMethod) {
      alert("Payment method is required for paid expenses.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(formMode === "create" ? "/api/expenses" : `/api/expenses/${activeExpenseId}`, {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod || null
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error ?? "Failed to save expense");
        return;
      }
      setOpen(false);
      success(formMode === "create" ? "Expense added successfully" : "Expense updated successfully");
      await loadExpenses(formMode === "create" ? 1 : pagination.page);
    } finally {
      setSaving(false);
    }
  }

  async function cancelExpense(expense: ExpenseRow) {
    if (expense.status === ExpenseStatus.CANCELLED) return;
    if (!window.confirm("Are you sure you want to cancel this expense?")) {
      return;
    }
    const response = await fetch(`/api/expenses/${expense.id}/cancel`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      alert(payload.error ?? "Failed to cancel expense");
      return;
    }
    success("Expense cancelled successfully");
    await loadExpenses(pagination.page);
  }

  return (
    <div className="grid expenses-screen">
      <div className="card expenses-shell">
        <div className="expenses-header">
          <div className="expenses-header-copy">
            <h1 className="section-title">Expenses</h1>
            <p className="expenses-header-meta">Track operating costs separately from inventory purchases.</p>
          </div>
          {canManage ? (
            <PrimaryButton className="expenses-add-btn" onClick={() => void openCreate()}>
              + Add Expense
            </PrimaryButton>
          ) : null}
        </div>

        <div className="grid grid-4 expenses-summary-grid">
          <div className="expenses-summary-card tone-total">
            <span className="expenses-summary-label">Total Expenses</span>
            <strong>{formatCurrency(summary.totalExpenses)}</strong>
          </div>
          <div className="expenses-summary-card tone-paid">
            <span className="expenses-summary-label">Paid Expenses</span>
            <strong>{formatCurrency(summary.paidExpenses)}</strong>
          </div>
          <div className="expenses-summary-card tone-pending">
            <span className="expenses-summary-label">Pending Expenses</span>
            <strong>{formatCurrency(summary.pendingExpenses)}</strong>
          </div>
          <div className="expenses-summary-card tone-cancelled">
            <span className="expenses-summary-label">Cancelled Expenses</span>
            <strong>{formatCurrency(summary.cancelledExpenses)}</strong>
          </div>
        </div>

        <div className="expenses-filters-card">
          <div className="expenses-search-row">
            <input
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Search expense no., description, payee, or reference..."
            />
          </div>
          <div className="expenses-filters">
            <label className="expenses-filter-field">
              <span>Category</span>
              <select
                value={filters.categoryId}
                onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="expenses-filter-field">
              <span>Status</span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, status: event.target.value as ExpenseStatus | "ALL" }))
                }
              >
                <option value="ALL">All Statuses</option>
                <option value={ExpenseStatus.PAID}>Paid</option>
                <option value={ExpenseStatus.PENDING}>Pending</option>
                <option value={ExpenseStatus.CANCELLED}>Cancelled</option>
              </select>
            </label>
            <label className="expenses-filter-field">
              <span>Payment Method</span>
              <select
                value={filters.paymentMethod}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    paymentMethod: event.target.value as ExpensePaymentMethod | "ALL"
                  }))
                }
              >
                <option value="ALL">All Payment Methods</option>
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="expenses-filter-field">
              <span>Date From</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              />
            </label>
            <label className="expenses-filter-field">
              <span>Date To</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="expenses-table-card">
          <div className="expenses-table-meta">
            <span>
              Showing {showingFrom} to {showingTo} of {pagination.total}
            </span>
            <strong>Filtered Total: {formatCurrency(summary.totalExpenses)}</strong>
          </div>

          <div className="table-wrap expenses-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense No.</th>
                <th>Category</th>
                <th>Description</th>
                <th>Payment</th>
                <th>Payee</th>
                <th className="expenses-amount-head">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length ? (
                expenses.map((expense) => (
                  <tr key={expense.id} className="expenses-row">
                    <td>{formatExpenseDate(expense.date)}</td>
                    <td>{expense.expenseNo}</td>
                    <td>{expense.category.name}</td>
                    <td>{expense.description}</td>
                    <td>{paymentMethodLabel(expense.paymentMethod)}</td>
                    <td>{expense.paidTo ?? "-"}</td>
                    <td className="expenses-amount-cell">{formatCurrency(expense.amount)}</td>
                    <td>
                      <span className={`badge expenses-status-badge expenses-status-${expense.status.toLowerCase()}`}>
                        {formatExpenseStatus(expense.status)}
                      </span>
                    </td>
                    <td>
                      <div className="row expenses-actions">
                        {canManage ? (
                          <>
                            <button
                              className="btn-secondary"
                              onClick={() => void openEdit(expense.id)}
                              disabled={expense.status === ExpenseStatus.CANCELLED}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => void cancelExpense(expense)}
                              disabled={expense.status === ExpenseStatus.CANCELLED}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="btn-secondary" onClick={() => void openEdit(expense.id)}>
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    {loading ? (
                      <div className="expenses-empty-state muted">Loading expenses...</div>
                    ) : (
                      <div className="expenses-empty-state">
                        <div className="expenses-empty-icon">
                          <ExpensesIcon />
                        </div>
                        <strong>No expenses yet</strong>
                        <p>Start by recording your first expense.</p>
                        {canManage ? (
                          <PrimaryButton className="expenses-empty-btn" onClick={() => void openCreate()}>
                            + Add Expense
                          </PrimaryButton>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>

        <div className="expenses-pagination">
          <span className="expenses-pagination-copy">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="row expenses-pagination-actions">
            <SecondaryButton
              disabled={pagination.page <= 1}
              onClick={() => void loadExpenses(pagination.page - 1)}
            >
              Prev
            </SecondaryButton>
            <span className="badge">Page {pagination.page}/{pagination.totalPages}</span>
            <SecondaryButton
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void loadExpenses(pagination.page + 1)}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      </div>

      {open ? (
        <div className="inventory-modal-overlay" onClick={() => !saving && setOpen(false)}>
          <div className="inventory-modal expenses-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="inventory-modal-header">
              <div>
                <h2 className="section-title">{formMode === "create" ? "Add Expense" : "Edit Expense"}</h2>
              </div>
              <button type="button" className="inventory-modal-close" onClick={() => !saving && setOpen(false)}>
                ×
              </button>
            </div>

            <div className="inventory-modal-body expenses-form">
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={form.categoryId}
                  onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">Select category</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field expenses-form-full">
                <span>Description</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Enter expense description"
                />
              </label>
              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="field">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) => {
                    const status = event.target.value as ExpenseStatus;
                    setForm((prev) => ({
                      ...prev,
                      status,
                      paymentMethod: status === ExpenseStatus.PAID ? prev.paymentMethod || ExpensePaymentMethod.CASH : ""
                    }));
                  }}
                >
                  <option value={ExpenseStatus.PAID}>PAID</option>
                  <option value={ExpenseStatus.PENDING}>PENDING</option>
                </select>
              </label>
              <label className="field">
                <span>Payment Method</span>
                <select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentMethod: event.target.value as ExpensePaymentMethod | ""
                    }))
                  }
                  disabled={form.status !== ExpenseStatus.PAID}
                >
                  <option value="">Select payment method</option>
                  {paymentMethodOptions.map((method) => (
                    <option key={method} value={method}>
                      {method.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Paid To</span>
                <input
                  value={form.paidTo}
                  onChange={(event) => setForm((prev) => ({ ...prev, paidTo: event.target.value }))}
                  placeholder="Optional payee"
                />
              </label>
              <label className="field">
                <span>Reference No.</span>
                <input
                  value={form.referenceNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
                  placeholder="Optional reference"
                />
              </label>
              <label className="field expenses-form-full">
                <span>Remarks</span>
                <textarea
                  rows={3}
                  value={form.remarks}
                  onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
                  placeholder="Optional remarks"
                />
              </label>
            </div>

            <div className="inventory-modal-footer">
              <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>Cancel</SecondaryButton>
              {canManage ? (
                <PrimaryButton onClick={() => void submitForm()} disabled={saving}>
                  {saving ? "Saving..." : formMode === "create" ? "Save Expense" : "Update Expense"}
                </PrimaryButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
