"use client";

import { useEffect, useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";

type Customer = {
  id: string;
  name: string;
  mobile: string;
};

type HistoryItem = {
  id: string;
  number: string;
  totalAmount: number;
  status: string;
  createdAt: string;
};

type CustomerMetric = {
  customerId: string;
  totalPurchases: number;
  totalVisits: number;
  lastVisit: string | null;
};

type AddCustomerForm = {
  name: string;
  mobile: string;
  email: string;
  address: string;
};

const money = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatMoney(value: number) {
  return `PHP ${money.format(value)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function CustomersScreen({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [metricsByCustomerId, setMetricsByCustomerId] = useState<Record<string, CustomerMetric>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addForm, setAddForm] = useState<AddCustomerForm>({
    name: "",
    mobile: "",
    email: "",
    address: ""
  });

  async function loadMetrics() {
    const response = await fetch("/api/customers/metrics");
    if (!response.ok) return;
    const rows = (await response.json()) as CustomerMetric[];
    const mapped = rows.reduce<Record<string, CustomerMetric>>((acc, item) => {
      acc[item.customerId] = item;
      return acc;
    }, {});
    setMetricsByCustomerId(mapped);
  }

  async function refreshCustomers() {
    const response = await fetch("/api/customers");
    const data = (await response.json()) as Customer[];
    setCustomers(data);
  }

  async function refreshAll() {
    await Promise.all([refreshCustomers(), loadMetrics()]);
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      return customer.name.toLowerCase().includes(q) || customer.mobile.toLowerCase().includes(q);
    });
  }, [customers, query]);

  async function openCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}/history`);
      const data = await response.json();
      setHistory(
        data.map((item: { id: string; number: string; totalAmount: string; status: string; createdAt: string }) => ({
          ...item,
          totalAmount: Number(item.totalAmount)
        }))
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  function openAddModal() {
    setAddForm({ name: "", mobile: "", email: "", address: "" });
    setIsAddOpen(true);
  }

  async function saveCustomer() {
    if (!addForm.name.trim() || !addForm.mobile.trim()) {
      alert("Name and Mobile are required.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          mobile: addForm.mobile.trim(),
          email: addForm.email.trim(),
          address: addForm.address.trim()
        })
      });
      if (!response.ok) {
        const payload = await response.json();
        alert(payload.error ?? "Failed to save customer.");
        return;
      }
      setIsAddOpen(false);
      await refreshAll();
    } finally {
      setIsSaving(false);
    }
  }

  const selectedMetric = selectedCustomer ? metricsByCustomerId[selectedCustomer.id] : undefined;
  const selectedTotalPurchases = selectedMetric?.totalPurchases ?? 0;
  const selectedTotalVisits = selectedMetric?.totalVisits ?? history.length;
  const selectedLastVisit = selectedMetric?.lastVisit ?? history[0]?.createdAt ?? null;

  return (
    <div className="customers-layout">
      <section className="card customers-left-panel">
        <div className="inventory-table-head">
          <h2 className="section-title">Customers</h2>
          <PrimaryButton className="customers-add-btn" onClick={openAddModal}>
            + Add Customer
          </PrimaryButton>
        </div>

        <div className="customers-toolbar">
          <input
            className="inventory-search"
            placeholder="Search customer..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Total Purchases</th>
                <th>Last Visit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => {
                const metric = metricsByCustomerId[customer.id];
                const isActive = selectedCustomer?.id === customer.id;
                return (
                  <tr
                    key={customer.id}
                    className={isActive ? "customers-row-active" : undefined}
                    onClick={() => void openCustomer(customer)}
                  >
                    <td>{customer.name}</td>
                    <td>{customer.mobile}</td>
                    <td>{formatMoney(metric?.totalPurchases ?? 0)}</td>
                    <td>{formatDateTime(metric?.lastVisit ?? null)}</td>
                    <td>
                      <button
                        className="btn-info"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openCustomer(customer);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No customers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card customers-right-panel">
        <h2 className="section-title">Customer Details</h2>
        {selectedCustomer ? (
          <>
            <div className="customers-details-grid">
              <div>
                <span className="muted">Name</span>
                <strong>{selectedCustomer.name}</strong>
              </div>
              <div>
                <span className="muted">Mobile</span>
                <strong>{selectedCustomer.mobile}</strong>
              </div>
              <div>
                <span className="muted">Total Purchases</span>
                <strong>{formatMoney(selectedTotalPurchases)}</strong>
              </div>
              <div>
                <span className="muted">Total Visits</span>
                <strong>{selectedTotalVisits}</strong>
              </div>
              <div>
                <span className="muted">Last Visit</span>
                <strong>{formatDateTime(selectedLastVisit)}</strong>
              </div>
            </div>

            <h3 className="section-title customers-history-title">Sales History</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        Loading history...
                      </td>
                    </tr>
                  ) : history.length ? (
                    history.map((item) => (
                      <tr key={item.id}>
                        <td>{item.number}</td>
                        <td>{formatMoney(item.totalAmount)}</td>
                        <td>{item.status}</td>
                        <td>{formatDateTime(item.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="muted">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="muted customers-empty-state">Select a customer from the list to view details and sales history.</div>
        )}
      </section>

      {isAddOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal customers-modal">
            <h3 className="section-title">Add Customer</h3>
            <div className="stack">
              <label className="form-field">
                <span className="field-label">Name</span>
                <input
                  value={addForm.name}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Enter customer name"
                />
              </label>
              <label className="form-field">
                <span className="field-label">Mobile</span>
                <input
                  value={addForm.mobile}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, mobile: event.target.value }))}
                  placeholder="Enter mobile number"
                />
              </label>
              <label className="form-field">
                <span className="field-label">Email (Optional)</span>
                <input
                  value={addForm.email}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Enter email address"
                />
              </label>
              <label className="form-field">
                <span className="field-label">Address (Optional)</span>
                <textarea
                  rows={2}
                  value={addForm.address}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Enter address"
                />
              </label>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton onClick={() => setIsAddOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveCustomer} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Customer"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
