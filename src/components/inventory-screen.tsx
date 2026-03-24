"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import {
  normalizeDecimalInput,
  normalizeIntegerInput,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  toNumber
} from "@/lib/numeric-input";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  compatibleUnits: string;
  barcode?: string | null;
  photoUrl: string | null;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  stockQty: number;
  allowNegativeStock: boolean;
  isActive: boolean;
  lowStockThreshold: number;
};

type SortKey = "name" | "sku" | "category" | "stockQty" | "sellingPrice";
type InventoryFilter = "active" | "archived" | "all";

export function InventoryScreen({
  initialProducts
}: {
  initialProducts: ProductRow[];
}) {
  const { data: session } = useSession();
  const isAdmin = ["OWNER", "MANAGER"].includes(session?.user?.role ?? "");
  const [products, setProducts] = useState(initialProducts);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("active");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ProductRow | null>(null);
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "General",
    description: "",
    compatibleUnits: "",
    barcode: "",
    unit: "pc",
    costPrice: 0,
    sellingPrice: 0,
    stockQty: 0,
    allowNegativeStock: false,
    isActive: true,
    lowStockThreshold: 0
  });
  const [createQtyInput, setCreateQtyInput] = useState("0");
  const [createPriceInput, setCreatePriceInput] = useState("0.00");

  useEffect(() => {
    if (!editOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editOpen]);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/products?filter=${inventoryFilter}`);
    const data = await response.json();
    setProducts(
      data.map(
        (item: ProductRow & {
          stockQty: string;
          sellingPrice: string;
          costPrice: string;
          lowStockThreshold: string;
          allowNegativeStock?: boolean;
          isActive?: boolean;
        }) => ({
          ...item,
          description: item.description ?? "",
          barcode: item.barcode ?? "",
          photoUrl: item.photoUrl ?? null,
          stockQty: Number(item.stockQty),
          sellingPrice: Number(item.sellingPrice),
          costPrice: Number(item.costPrice),
          allowNegativeStock: Boolean(item.allowNegativeStock),
          isActive: Boolean(item.isActive),
          lowStockThreshold: Number(item.lowStockThreshold)
        })
      )
    );
  }, [inventoryFilter]);

  useEffect(() => {
    void refresh();
    setPage(1);
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = !q
      ? products
      : products.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            (item.barcode ?? "").toLowerCase().includes(q)
        );
    const sorted = [...searched].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDir === "asc" ? aValue - bValue : bValue - aValue;
      }
      const aText = String(aValue).toLowerCase();
      const bText = String(bValue).toLowerCase();
      return sortDir === "asc" ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });
    return sorted;
  }, [products, query, sortKey, sortDir]);

  const entries = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / entries));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * entries;
  const pageData = filtered.slice(pageStart, pageStart + entries);

  const metrics = useMemo(() => {
    const totalItems = products.length;
    const lowStockItems = products.filter(
      (item) => item.stockQty <= Math.max(0, item.lowStockThreshold)
    ).length;
    const availableCategories = new Set(products.map((item) => item.category).filter(Boolean)).size;
    const inventoryValue = products.reduce(
      (sum, item) => sum + Math.max(0, item.stockQty) * Math.max(0, item.costPrice),
      0
    );
    return { totalItems, lowStockItems, availableCategories, inventoryValue };
  }, [products]);

  function getStockStatus(item: ProductRow) {
    if (item.stockQty <= 0) {
      return { label: "Out of Stock", className: "inventory-status-out" };
    }
    if (item.stockQty <= Math.max(0, item.lowStockThreshold)) {
      return { label: "Low Stock", className: "inventory-status-low" };
    }
    return { label: "In Stock", className: "inventory-status-in" };
  }

  function changeSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setSortDir("asc");
  }

  function openCreate() {
    setForm({
      name: "",
      sku: "",
      category: "General",
      description: "",
      compatibleUnits: "",
      barcode: "",
      unit: "pc",
      costPrice: 0,
      sellingPrice: 0,
      stockQty: 0,
      allowNegativeStock: false,
      isActive: true,
      lowStockThreshold: 0
    });
    setCreateQtyInput("0");
    setCreatePriceInput("0.00");
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
    setCreateOpen(true);
  }

  function openEdit(product: ProductRow) {
    setActiveProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description,
      compatibleUnits: product.compatibleUnits ?? "",
      barcode: product.barcode ?? "",
      unit: product.unit,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      stockQty: product.stockQty,
      allowNegativeStock: product.allowNegativeStock,
      isActive: product.isActive,
      lowStockThreshold: product.lowStockThreshold
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(product.photoUrl ?? null);
    setEditOpen(true);
  }

  function onCreatePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCreatePhotoFile(file);
    if (createPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(createPhotoPreview);
    }
    if (!file) {
      setCreatePhotoPreview(null);
      return;
    }
    setCreatePhotoPreview(URL.createObjectURL(file));
  }

  function clearCreatePhoto() {
    if (createPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(createPhotoPreview);
    }
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
  }

  function onEditPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setEditPhotoFile(file);
    if (editPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editPhotoPreview);
    }
    if (!file) {
      setEditPhotoPreview(activeProduct?.photoUrl ?? null);
      return;
    }
    setEditPhotoPreview(URL.createObjectURL(file));
  }

  function clearEditPhoto() {
    if (editPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editPhotoPreview);
    }
    setEditPhotoFile(null);
    setEditPhotoPreview(activeProduct?.photoUrl ?? null);
  }

  async function createProduct() {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to create product");
      return;
    }
    const created = await response.json();
    if (createPhotoFile) {
      try {
        const body = new FormData();
        body.append("file", createPhotoFile);
        const photoResponse = await fetch(`/api/products/${encodeURIComponent(created.id)}/photo`, {
          method: "POST",
          body
        });
        if (!photoResponse.ok) {
          let message = "Item saved, but photo upload failed.";
          const contentType = photoResponse.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const payload = await photoResponse.json();
            message = payload.error ?? message;
          }
          alert(message);
        }
      } catch {
        alert("Item saved, but photo upload failed.");
      }
    }
    setCreateOpen(false);
    clearCreatePhoto();
    await refresh();
  }

  async function updateProduct() {
    if (!activeProduct) return;
    if (!form.name.trim()) {
      alert("Product Name is required");
      return;
    }
    if (!Number.isFinite(form.sellingPrice)) {
      alert("Price must be numeric");
      return;
    }
    if (!Number.isFinite(form.stockQty)) {
      alert("Quantity must be numeric");
      return;
    }
    const response = await fetch(`/api/products/${activeProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to update product");
      return;
    }
    if (editPhotoFile) {
      try {
        const body = new FormData();
        body.append("file", editPhotoFile);
        const photoResponse = await fetch(`/api/products/${encodeURIComponent(activeProduct.id)}/photo`, {
          method: "POST",
          body
        });
        if (!photoResponse.ok) {
          let message = "Item updated, but photo upload failed.";
          const contentType = photoResponse.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const payload = await photoResponse.json();
            message = payload.error ?? message;
          }
          alert(message);
        }
      } catch {
        alert("Item updated, but photo upload failed.");
      }
    }
    setEditOpen(false);
    clearEditPhoto();
    setActiveProduct(null);
    await refresh();
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("Permanently delete this item? This cannot be undone.")) return;
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to delete");
      return;
    }
    await refresh();
  }

  async function archiveProduct(id: string) {
    if (!window.confirm("Archive this item? It will be hidden from active inventory and POS.")) return;
    const response = await fetch(`/api/products/${id}/archive`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to archive item");
      return;
    }
    await refresh();
  }

  async function restoreProduct(id: string) {
    const response = await fetch(`/api/products/${id}/restore`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to restore item");
      return;
    }
    await refresh();
  }

  return (
    <div className="inventory-admin">
      <div className="inventory-kpis">
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon">#</div>
          <div className="inventory-kpi-label">Total Items</div>
          <div className="inventory-kpi-value">{metrics.totalItems}</div>
        </div>
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon">LOW</div>
          <div className="inventory-kpi-label">Low Stock Items</div>
          <div className="inventory-kpi-value">{metrics.lowStockItems}</div>
        </div>
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon">CAT</div>
          <div className="inventory-kpi-label">Available Categories</div>
          <div className="inventory-kpi-value">{metrics.availableCategories}</div>
        </div>
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon">PHP</div>
          <div className="inventory-kpi-label">Inventory Value</div>
          <div className="inventory-kpi-value">PHP {metrics.inventoryValue.toLocaleString("en-PH", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="card">
        <div className="inventory-table-head">
          <h2 className="section-title">Inventory</h2>
          <PrimaryButton className="inventory-add-btn" onClick={openCreate}>
            + Add Item
          </PrimaryButton>
        </div>

        <div className="inventory-toolbar-search">
          <div className="row inventory-filter-row">
            <button
              type="button"
              className={inventoryFilter === "active" ? "configuration-tab active" : "configuration-tab"}
              onClick={() => setInventoryFilter("active")}
            >
              Active
            </button>
            <button
              type="button"
              className={inventoryFilter === "archived" ? "configuration-tab active" : "configuration-tab"}
              onClick={() => setInventoryFilter("archived")}
            >
              Archived
            </button>
            <button
              type="button"
              className={inventoryFilter === "all" ? "configuration-tab active" : "configuration-tab"}
              onClick={() => setInventoryFilter("all")}
            >
              All
            </button>
          </div>
          <input
            placeholder="Search product name / SKU / barcode"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="inventory-search"
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>
                  <button type="button" className="table-sort-btn" onClick={() => changeSort("name")}>
                    Product Name
                  </button>
                </th>
                <th>
                  <button type="button" className="table-sort-btn" onClick={() => changeSort("sku")}>
                    SKU
                  </button>
                </th>
                <th>
                  <button type="button" className="table-sort-btn" onClick={() => changeSort("category")}>
                    Category
                  </button>
                </th>
                <th>
                  <button type="button" className="table-sort-btn" onClick={() => changeSort("stockQty")}>
                    Stock
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="table-sort-btn"
                    onClick={() => changeSort("sellingPrice")}
                  >
                    Price
                  </button>
                </th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((item) => {
                const stockStatus = getStockStatus(item);
                return (
                <tr key={item.id}>
                  <td>
                    {item.photoUrl ? (
                      <Image
                        src={item.photoUrl}
                        alt={item.name}
                        width={44}
                        height={44}
                        className="inventory-thumb"
                      />
                    ) : (
                      <span className="inventory-photo-empty">No photo</span>
                    )}
                  </td>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td>{item.category}</td>
                  <td>{item.stockQty}</td>
                  <td>PHP {item.sellingPrice.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${stockStatus.className}`}>{stockStatus.label}</span>
                  </td>
                  <td>
                    <div className="inventory-actions">
                      <button className="btn-info" onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      {item.isActive ? (
                        <button className="btn-secondary" onClick={() => archiveProduct(item.id)}>
                          Archive Item
                        </button>
                      ) : (
                        <button className="btn-success" onClick={() => restoreProduct(item.id)}>
                          Restore
                        </button>
                      )}
                      {!item.isActive && isAdmin ? (
                        <button className="btn-danger" onClick={() => deleteProduct(item.id)}>
                          Permanently Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
              {!pageData.length ? (
                <tr>
                  <td colSpan={8} className="muted">
                    {inventoryFilter === "active"
                      ? "No active inventory items yet."
                      : inventoryFilter === "archived"
                        ? "No archived items yet."
                        : "No inventory items yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="inventory-pagination">
          <div>
            Showing {pageData.length ? pageStart + 1 : 0} to {pageStart + pageData.length} of {filtered.length}
          </div>
          <div className="row">
            <button
              className="btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Prev
            </button>
            <span className="badge">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {createOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <h3 className="section-title">Add Item</h3>
            <div className="stack">
              <div className="form-field">
                <label className="field-label">Product Name</label>
                <input
                  placeholder="Enter product name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">SKU</label>
                <input
                  placeholder="Enter SKU"
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Description</label>
                <textarea
                  placeholder="Enter description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="row">
                <div className="form-field">
                  <label className="field-label">Initial Quantity</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={createQtyInput}
                    onChange={(event) => {
                      const next = sanitizeIntegerInput(event.target.value);
                      setCreateQtyInput(next);
                      setForm({ ...form, stockQty: Number(next || "0") });
                    }}
                    onBlur={() => {
                      const normalized = normalizeIntegerInput(createQtyInput);
                      setCreateQtyInput(normalized);
                      setForm({ ...form, stockQty: Number(normalized) });
                    }}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={createPriceInput}
                    onChange={(event) => {
                      const next = sanitizeDecimalInput(event.target.value);
                      setCreatePriceInput(next);
                      setForm({
                        ...form,
                        sellingPrice: toNumber(next),
                        costPrice: toNumber(next)
                      });
                    }}
                    onBlur={() => {
                      const normalized = normalizeDecimalInput(createPriceInput);
                      setCreatePriceInput(normalized);
                      setForm({
                        ...form,
                        sellingPrice: toNumber(normalized),
                        costPrice: toNumber(normalized)
                      });
                    }}
                  />
                </div>
              </div>
              <div className="form-field">
                <label className="field-label">Compatible Units</label>
                <textarea
                  placeholder=""
                  value={form.compatibleUnits ?? ""}
                  onChange={(event) => setForm({ ...form, compatibleUnits: event.target.value })}
                />
                <div className="field-help">
                  For cashier reference only. Does not affect pricing or stock.
                </div>
              </div>
              <div className="form-field">
                <label className="field-label">Product Photo (Optional)</label>
                {createPhotoPreview ? (
                  <Image
                    src={createPhotoPreview}
                    alt="New item preview"
                    width={640}
                    height={240}
                    className="inventory-photo-preview"
                  />
                ) : (
                  <div className="inventory-photo-empty-lg">No photo selected</div>
                )}
                <div className="row">
                  <input type="file" accept="image/*" onChange={onCreatePhotoSelected} />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onCreatePhotoSelected}
                  />
                </div>
                {createPhotoFile ? (
                  <SecondaryButton onClick={clearCreatePhoto}>Clear Photo</SecondaryButton>
                ) : null}
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton
                onClick={() => {
                  setCreateOpen(false);
                  clearCreatePhoto();
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={createProduct}>Save</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal inventory-modal-responsive">
            <div className="inventory-modal-header">
              <h3 className="section-title">Update Item</h3>
            </div>
            <div className="inventory-modal-body">
              <div className="stack">
              <div className="form-field">
                <label className="field-label">Product Name</label>
                <input
                  placeholder="Product Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">SKU</label>
                <input
                  placeholder="SKU"
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Description</label>
                <textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Category</label>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {Array.from(new Set(products.map((product) => product.category).filter(Boolean))).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="General">General</option>
                </select>
              </div>
              <div className="row">
                <div className="form-field">
                  <label className="field-label">Quantity (Current Stock)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.stockQty}
                    onChange={(event) =>
                      setForm({ ...form, stockQty: toNumber(sanitizeDecimalInput(event.target.value)) })
                    }
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.sellingPrice}
                    onChange={(event) =>
                      setForm({ ...form, sellingPrice: toNumber(sanitizeDecimalInput(event.target.value)) })
                    }
                  />
                </div>
              </div>
              <div className="form-field">
                <label className="field-label">Barcode</label>
                <input
                  placeholder="Barcode"
                  value={form.barcode ?? ""}
                  onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                />
              </div>
              <label className="configuration-check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Active
              </label>
              <div className="form-field">
                <label className="field-label">Photo Upload / Replace Photo</label>
                {editPhotoPreview ? (
                  <Image
                    src={editPhotoPreview}
                    alt="Update item preview"
                    width={640}
                    height={240}
                    className="inventory-photo-preview inventory-photo-preview-edit"
                  />
                ) : (
                  <div className="inventory-photo-empty-lg">No photo selected</div>
                )}
                <input type="file" accept="image/*" onChange={onEditPhotoSelected} />
                {editPhotoFile ? <SecondaryButton onClick={clearEditPhoto}>Clear Photo</SecondaryButton> : null}
              </div>
            </div>
            </div>
            <div className="row inventory-modal-footer">
              <SecondaryButton
                onClick={() => {
                  setEditOpen(false);
                  clearEditPhoto();
                  setActiveProduct(null);
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={updateProduct}>Save Changes</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
