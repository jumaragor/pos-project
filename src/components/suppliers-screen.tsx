"use client";

import { SupplierStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";

type SupplierRow = {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string | null;
  mobileNumber: string | null;
  emailAddress: string | null;
  address: string | null;
  notes: string | null;
  status: SupplierStatus;
};

type SupplierForm = {
  supplierName: string;
  contactPerson: string;
  mobileNumber: string;
  emailAddress: string;
  address: string;
  notes: string;
  status: SupplierStatus;
};

type Mode = "create" | "edit" | "view";

const emptyForm: SupplierForm = {
  supplierName: "",
  contactPerson: "",
  mobileNumber: "",
  emailAddress: "",
  address: "",
  notes: "",
  status: SupplierStatus.ACTIVE
};

function statusClass(status: SupplierStatus) {
  return status === SupplierStatus.ACTIVE ? "badge purchases-status-posted" : "badge purchases-status-draft";
}

export function SuppliersScreen({ initialSuppliers }: { initialSuppliers: SupplierRow[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [activeSupplier, setActiveSupplier] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  async function refresh() {
    const response = await fetch("/api/suppliers");
    const payload = await response.json();
    setSuppliers(payload);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((supplier) => {
      return (
        supplier.supplierCode.toLowerCase().includes(q) ||
        supplier.supplierName.toLowerCase().includes(q) ||
        (supplier.contactPerson ?? "").toLowerCase().includes(q) ||
        (supplier.mobileNumber ?? "").toLowerCase().includes(q) ||
        (supplier.emailAddress ?? "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, query]);

  function openCreate() {
    setMode("create");
    setActiveSupplier(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(supplier: SupplierRow) {
    setMode("edit");
    setActiveSupplier(supplier);
    setForm({
      supplierName: supplier.supplierName,
      contactPerson: supplier.contactPerson ?? "",
      mobileNumber: supplier.mobileNumber ?? "",
      emailAddress: supplier.emailAddress ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
      status: supplier.status
    });
    setOpen(true);
  }

  function openView(supplier: SupplierRow) {
    setMode("view");
    setActiveSupplier(supplier);
    setForm({
      supplierName: supplier.supplierName,
      contactPerson: supplier.contactPerson ?? "",
      mobileNumber: supplier.mobileNumber ?? "",
      emailAddress: supplier.emailAddress ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
      status: supplier.status
    });
    setOpen(true);
  }

  async function saveSupplier() {
    if (!form.supplierName.trim()) {
      alert("Supplier Name is required");
      return;
    }
    const endpoint = mode === "edit" && activeSupplier ? `/api/suppliers/${activeSupplier.id}` : "/api/suppliers";
    const method = mode === "edit" ? "PUT" : "POST";
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        const payload = await response.json();
        alert(payload.error ?? "Failed to save supplier");
        return;
      }
      setOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deactivateSupplier(supplier: SupplierRow) {
    if (supplier.status === SupplierStatus.INACTIVE) return;
    if (!window.confirm(`Deactivate ${supplier.supplierName}?`)) return;
    const response = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to deactivate supplier");
      return;
    }
    await refresh();
  }

  const readOnly = mode === "view";

  return (
    <div className="grid">
      <div className="card">
        <div className="inventory-table-head">
          <h2 className="section-title">Suppliers</h2>
          <PrimaryButton className="suppliers-new-btn" onClick={openCreate}>
            + New Supplier
          </PrimaryButton>
        </div>
        <div className="inventory-filters">
          <div className="muted">Maintain your supplier master list for purchases and restocking.</div>
          <input
            className="inventory-search"
            placeholder="Search code, supplier, contact, mobile, email..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier Code</th>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Mobile Number</th>
                <th>Email Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.supplierCode}</td>
                  <td>{supplier.supplierName}</td>
                  <td>{supplier.contactPerson || "-"}</td>
                  <td>{supplier.mobileNumber || "-"}</td>
                  <td>{supplier.emailAddress || "-"}</td>
                  <td>
                    <span className={statusClass(supplier.status)}>{supplier.status}</span>
                  </td>
                  <td>
                    <div className="inventory-actions">
                      <button className="btn-info" onClick={() => openView(supplier)}>
                        View
                      </button>
                      <button className="btn-secondary" onClick={() => openEdit(supplier)}>
                        Edit
                      </button>
                      {supplier.status === SupplierStatus.ACTIVE ? (
                        <button className="btn-danger" onClick={() => deactivateSupplier(supplier)}>
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No suppliers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <h3 className="section-title">
              {mode === "create" ? "New Supplier" : mode === "edit" ? "Edit Supplier" : "View Supplier"}
            </h3>
            <div className="stack">
              {mode !== "create" && activeSupplier ? (
                <div className="form-field">
                  <label className="field-label">Supplier Code</label>
                  <input value={activeSupplier.supplierCode} disabled />
                </div>
              ) : null}
              <div className="form-field">
                <label className="field-label">Supplier Name</label>
                <input
                  value={form.supplierName}
                  disabled={readOnly}
                  onChange={(event) => setForm((prev) => ({ ...prev, supplierName: event.target.value }))}
                />
              </div>
              <div className="grid grid-2">
                <div className="form-field">
                  <label className="field-label">Contact Person</label>
                  <input
                    value={form.contactPerson}
                    disabled={readOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, contactPerson: event.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Mobile Number</label>
                  <input
                    value={form.mobileNumber}
                    disabled={readOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-2">
                <div className="form-field">
                  <label className="field-label">Email Address</label>
                  <input
                    value={form.emailAddress}
                    disabled={readOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, emailAddress: event.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Status</label>
                  <select
                    value={form.status}
                    disabled={readOnly}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value as SupplierStatus }))
                    }
                  >
                    <option value={SupplierStatus.ACTIVE}>Active</option>
                    <option value={SupplierStatus.INACTIVE}>Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label className="field-label">Address</label>
                <textarea
                  rows={2}
                  value={form.address}
                  disabled={readOnly}
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  disabled={readOnly}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
              {!readOnly ? (
                <PrimaryButton onClick={saveSupplier} disabled={saving}>
                  {saving ? "Saving..." : "Save Supplier"}
                </PrimaryButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
