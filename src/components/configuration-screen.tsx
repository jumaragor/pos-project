"use client";

import { Role, UserStatus } from "@prisma/client";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { useToast } from "@/components/toast-provider";
import {
  applyThemeToDocument,
  defaultThemeValues,
  isValidHexColor,
  ThemePresetKey,
  themePresets
} from "@/lib/theme";

type TabKey =
  | "users"
  | "inventory"
  | "tax"
  | "pos"
  | "store"
  | "product"
  | "categories"
  | "system";

type UserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
};

type UserForm = {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "ADMIN" | "CASHIER";
  status: UserStatus;
};
type CategoryRow = {
  id: string;
  name: string;
  code: string;
  skuPrefix: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  productCount: number;
};

type CategoryForm = {
  name: string;
  code: string;
  skuPrefix: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
};

type SettingsShape = {
  allowNegativeStock: boolean;
  lowStockThreshold: number;
  allowManualStockAdjustments: boolean;
  allowProductDeletion: boolean;
  enableLowStockAlerts: boolean;
  enableTax: boolean;
  defaultTaxRate: number;
  taxInclusivePricing: boolean;
  allowManualTaxEntryInPurchases: boolean;
  enableBarcodeScanner: boolean;
  allowPriceOverride: boolean;
  allowDiscountEntry: boolean;
  autoPrintReceipt: boolean;
  defaultPaymentMethod: "CASH" | "GCASH" | "CARD";
  requireCustomerBeforeSale: boolean;
  storeName: string;
  businessName: string;
  storeAddress: string;
  storeContactNumber: string;
  storeEmailAddress: string;
  storeLogoUrl: string;
  receiptFooterMessage: string;
  tin: string;
  permitNo: string;
  enableProductCategories: boolean;
  enableCompatibleUnits: boolean;
  allowProductPhotoUpload: boolean;
  requireSKU: boolean;
  autoGenerateSKU: boolean;
  skuGenerationMode: "MANUAL" | "GLOBAL" | "CATEGORY_BASED";
  currency: "PHP";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  numberFormat: "1,000.00" | "1.000,00";
  timezone: string;
  themePreset: ThemePresetKey;
  themePrimaryColor: string;
  themeAccentColor: string;
  themeSidebarActiveColor: string;
  themeDangerColor: string;
};

const tabMeta: { key: TabKey; label: string }[] = [
  { key: "users", label: "Users & Roles" },
  { key: "inventory", label: "Inventory Controls" },
  { key: "tax", label: "Tax Settings" },
  { key: "pos", label: "POS Settings" },
  { key: "store", label: "Store Information" },
  { key: "product", label: "Product Settings" },
  { key: "categories", label: "Categories" },
  { key: "system", label: "System Preferences" }
];

const defaultSettings: SettingsShape = {
  allowNegativeStock: false,
  lowStockThreshold: 10,
  allowManualStockAdjustments: true,
  allowProductDeletion: false,
  enableLowStockAlerts: true,
  enableTax: true,
  defaultTaxRate: 12,
  taxInclusivePricing: false,
  allowManualTaxEntryInPurchases: true,
  enableBarcodeScanner: true,
  allowPriceOverride: false,
  allowDiscountEntry: true,
  autoPrintReceipt: false,
  defaultPaymentMethod: "CASH",
  requireCustomerBeforeSale: false,
  storeName: "MicroBiz POS",
  businessName: "",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "Thank you for shopping!",
  tin: "",
  permitNo: "",
  enableProductCategories: true,
  enableCompatibleUnits: true,
  allowProductPhotoUpload: true,
  requireSKU: true,
  autoGenerateSKU: false,
  skuGenerationMode: "GLOBAL",
  currency: "PHP",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,000.00",
  timezone: "Asia/Manila",
  themePreset: "DEFAULT_NAVY",
  themePrimaryColor: defaultThemeValues.themePrimaryColor,
  themeAccentColor: defaultThemeValues.themeAccentColor,
  themeSidebarActiveColor: defaultThemeValues.themeSidebarActiveColor,
  themeDangerColor: defaultThemeValues.themeDangerColor
};

const emptyUserForm: UserForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "CASHIER",
  status: UserStatus.ACTIVE
};
const emptyCategoryForm: CategoryForm = {
  name: "",
  code: "",
  skuPrefix: "",
  description: "",
  status: "ACTIVE",
  sortOrder: 0
};

function toUiRole(role: Role): "ADMIN" | "CASHIER" {
  return role === Role.CASHIER ? "CASHIER" : "ADMIN";
}

function toApiRole(role: "ADMIN" | "CASHIER") {
  return role === "ADMIN" ? "OWNER" : "CASHIER";
}

function formatLastLogin(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH");
}

const themePresetOptions: Array<{ value: ThemePresetKey; label: string }> = [
  { value: "DEFAULT_NAVY", label: "Default Navy" },
  { value: "MODERN_BLUE", label: "Modern Blue" },
  { value: "FOREST_GREEN", label: "Forest Green" },
  { value: "ELEGANT_PURPLE", label: "Elegant Purple" },
  { value: "WARM_ORANGE", label: "Warm Orange" },
  { value: "CUSTOM", label: "Custom" }
];

function centeredConfigurationForm(content: React.ReactNode) {
  return (
    <div className="configuration-form-shell">
      <div className="card configuration-panel configuration-form-card">{content}</div>
    </div>
  );
}

export function ConfigurationScreen() {
  const { data } = useSession();
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [settings, setSettings] = useState<SettingsShape>(defaultSettings);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [userMode, setUserMode] = useState<"create" | "edit">("create");
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryMode, setCategoryMode] = useState<"create" | "edit">("create");
  const [activeCategory, setActiveCategory] = useState<CategoryRow | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);

  const isAdmin = ["OWNER", "MANAGER"].includes(data?.user?.role ?? "");

  async function loadSettings() {
    const response = await fetch("/api/settings");
    const payload = (await response.json()) as SettingsShape;
    setSettings((prev) => ({ ...prev, ...payload }));
  }

  async function loadUsers() {
    const response = await fetch("/api/users");
    if (!response.ok) return;
    const payload = await response.json();
    setUsers(payload);
  }

  async function loadCategories() {
    const response = await fetch("/api/categories?pageSize=100");
    if (!response.ok) return;
    const payload = (await response.json()) as { items: CategoryRow[] };
    setCategories(payload.items);
  }

  useEffect(() => {
    void loadSettings();
    void loadUsers();
    void loadCategories();
  }, []);

  function openCreateUser() {
    setUserMode("create");
    setActiveUser(null);
    setUserForm(emptyUserForm);
    setUserOpen(true);
  }

  function openCreateCategory() {
    setCategoryMode("create");
    setActiveCategory(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryOpen(true);
  }

  function openEditCategory(category: CategoryRow) {
    setCategoryMode("edit");
    setActiveCategory(category);
    setCategoryForm({
      name: category.name,
      code: category.code,
      skuPrefix: category.skuPrefix,
      description: category.description ?? "",
      status: category.status,
      sortOrder: category.sortOrder
    });
    setCategoryOpen(true);
  }

  function openEditUser(user: UserRow) {
    setUserMode("edit");
    setActiveUser(user);
    setUserForm({
      name: user.name,
      username: user.username ?? "",
      email: user.email,
      password: "",
      confirmPassword: "",
      role: toUiRole(user.role),
      status: user.status
    });
    setUserOpen(true);
  }

  async function saveUser() {
    if (!userForm.name.trim() || !userForm.username.trim() || !userForm.email.trim()) {
      alert("Full Name, Username, and Email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) {
      alert("Please provide a valid email address.");
      return;
    }
    if (userMode === "create" && !userForm.password) {
      alert("Password is required.");
      return;
    }
    if (userForm.password || userForm.confirmPassword) {
      if (userForm.password !== userForm.confirmPassword) {
        alert("Password and Confirm Password must match.");
        return;
      }
    }

    const endpoint = userMode === "edit" && activeUser ? `/api/users/${activeUser.id}` : "/api/users";
    const method = userMode === "edit" ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userForm.name.trim(),
        username: userForm.username.trim().toLowerCase(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password || undefined,
        role: toApiRole(userForm.role),
        status: userForm.status
      })
    });

    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to save user.");
      return;
    }
    setUserOpen(false);
    await loadUsers();
    success(userMode === "edit" ? "Changes saved successfully" : "Record saved successfully");
  }

  async function saveCategory() {
    if (!categoryForm.name.trim() || !categoryForm.code.trim() || !categoryForm.skuPrefix.trim()) {
      alert("Category Name, Category Code, and SKU Prefix are required.");
      return;
    }
    const endpoint =
      categoryMode === "edit" && activeCategory ? `/api/categories/${activeCategory.id}` : "/api/categories";
    const method = categoryMode === "edit" ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: categoryForm.name.trim(),
        code: categoryForm.code.trim().toUpperCase(),
        skuPrefix: categoryForm.skuPrefix.trim().toUpperCase(),
        description: categoryForm.description.trim(),
        status: categoryForm.status,
        sortOrder: categoryForm.sortOrder
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to save category.");
      return;
    }
    setCategoryOpen(false);
    await loadCategories();
    success(categoryMode === "edit" ? "Changes saved successfully" : "Record saved successfully");
  }

  async function toggleCategoryStatus(category: CategoryRow) {
    const response = await fetch(`/api/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: category.name,
        code: category.code,
        skuPrefix: category.skuPrefix,
        description: category.description ?? "",
        status: category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        sortOrder: category.sortOrder
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to update category status.");
      return;
    }
    await loadCategories();
    success("Process successful");
  }

  async function deleteCategory(category: CategoryRow) {
    if (!window.confirm(`Delete category ${category.name}?`)) return;
    const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to delete category.");
      return;
    }
    await loadCategories();
    success("Deleted successfully");
  }

  async function toggleUserStatus(user: UserRow) {
    const nextStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: nextStatus
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to update user status.");
      return;
    }
    await loadUsers();
    success("Process successful");
  }

  async function saveSettings(keys: (keyof SettingsShape)[], successMessage = "Changes saved successfully") {
    const payload = Object.fromEntries(keys.map((key) => [key, settings[key]]));
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      alert("Failed to save configuration.");
      return;
    }
    const json = (await response.json()) as SettingsShape;
    setSettings((prev) => ({ ...prev, ...json }));
    window.dispatchEvent(new Event("microbiz:settings-updated"));
    success(successMessage);
  }

  function validateThemeValues() {
    const pairs: Array<[string, string]> = [
      ["Primary Color", settings.themePrimaryColor],
      ["Accent Color", settings.themeAccentColor],
      ["Sidebar Active Color", settings.themeSidebarActiveColor],
      ["Danger Color", settings.themeDangerColor]
    ];
    for (const [label, value] of pairs) {
      if (!isValidHexColor(value)) {
        alert(`${label} must be a valid hex color (example: #1E3A8A).`);
        return false;
      }
    }
    return true;
  }

  function colorInputValue(value: string, fallback: string) {
    return isValidHexColor(value) ? value : fallback;
  }

  function updateThemeField(key: keyof Pick<SettingsShape, "themePrimaryColor" | "themeAccentColor" | "themeSidebarActiveColor" | "themeDangerColor">, value: string) {
    setSettings((prev) => ({
      ...prev,
      themePreset: "CUSTOM",
      [key]: value.toUpperCase()
    }));
  }

  function applyThemePreview() {
    if (!validateThemeValues()) return;
    applyThemeToDocument({
      themePreset: settings.themePreset,
      themePrimaryColor: settings.themePrimaryColor,
      themeAccentColor: settings.themeAccentColor,
      themeSidebarActiveColor: settings.themeSidebarActiveColor,
      themeDangerColor: settings.themeDangerColor
    });
  }

  function resetThemeToDefault() {
    setSettings((prev) => ({
      ...prev,
      themePreset: "DEFAULT_NAVY",
      themePrimaryColor: defaultThemeValues.themePrimaryColor,
      themeAccentColor: defaultThemeValues.themeAccentColor,
      themeSidebarActiveColor: defaultThemeValues.themeSidebarActiveColor,
      themeDangerColor: defaultThemeValues.themeDangerColor
    }));
    applyThemeToDocument(defaultThemeValues);
  }

  async function saveSystemSettings() {
    if (!validateThemeValues()) return;
    await saveSettings([
      "currency",
      "dateFormat",
      "numberFormat",
      "timezone",
      "themePreset",
      "themePrimaryColor",
      "themeAccentColor",
      "themeSidebarActiveColor",
      "themeDangerColor"
    ]);
    applyThemePreview();
  }

  function renderContent() {
    if (!isAdmin) {
      return (
        <div className="configuration-form-shell">
          <div className="card configuration-form-card">
            Access denied. Only Admin can access Configuration.
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case "users":
        return (
          <div className="card">
            <div className="inventory-table-head">
              <h2 className="section-title">Users & Roles</h2>
              <PrimaryButton className="configuration-inline-btn" onClick={openCreateUser}>
                + Add User
              </PrimaryButton>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.id}>
                      <td>{index + 1}</td>
                      <td>{user.name}</td>
                      <td>{user.username || "-"}</td>
                      <td>{toUiRole(user.role)}</td>
                      <td>
                        <span className={user.status === UserStatus.ACTIVE ? "badge purchases-status-posted" : "badge purchases-status-draft"}>
                          {user.status}
                        </span>
                      </td>
                      <td>{formatLastLogin(user.lastLoginAt)}</td>
                      <td>
                        <div className="inventory-actions">
                          <button className="btn-secondary" onClick={() => openEditUser(user)}>
                            Update
                          </button>
                          <button className={user.status === UserStatus.ACTIVE ? "btn-danger" : "btn-success"} onClick={() => toggleUserStatus(user)}>
                            {user.status === UserStatus.ACTIVE ? "Disable" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "inventory":
        return centeredConfigurationForm(
          <>
            <h2 className="section-title">Inventory Controls</h2>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowNegativeStock} onChange={(e) => setSettings((p) => ({ ...p, allowNegativeStock: e.target.checked }))} />Allow Negative Stock</label>
            <label className="form-field"><span className="field-label">Low Stock Threshold</span><input type="number" value={settings.lowStockThreshold} onChange={(e) => setSettings((p) => ({ ...p, lowStockThreshold: Number(e.target.value) }))} /></label>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowManualStockAdjustments} onChange={(e) => setSettings((p) => ({ ...p, allowManualStockAdjustments: e.target.checked }))} />Allow Manual Stock Adjustments</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowProductDeletion} onChange={(e) => setSettings((p) => ({ ...p, allowProductDeletion: e.target.checked }))} />Allow Product Deletion</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.enableLowStockAlerts} onChange={(e) => setSettings((p) => ({ ...p, enableLowStockAlerts: e.target.checked }))} />Enable Low Stock Alerts</label>
            <div className="configuration-actions">
              <PrimaryButton
                className="configuration-save-btn"
                onClick={() =>
                  saveSettings([
                    "allowNegativeStock",
                    "lowStockThreshold",
                    "allowManualStockAdjustments",
                    "allowProductDeletion",
                    "enableLowStockAlerts"
                  ])
                }
              >
                Save Changes
              </PrimaryButton>
            </div>
          </>
        );
      case "tax":
        return centeredConfigurationForm(
          <>
            <h2 className="section-title">Tax Settings</h2>
            <label className="configuration-check"><input type="checkbox" checked={settings.enableTax} onChange={(e) => setSettings((p) => ({ ...p, enableTax: e.target.checked }))} />Enable Tax</label>
            <label className="form-field"><span className="field-label">Default Tax Rate (%)</span><input type="number" value={settings.defaultTaxRate} onChange={(e) => setSettings((p) => ({ ...p, defaultTaxRate: Number(e.target.value) }))} /></label>
            <label className="configuration-check"><input type="checkbox" checked={settings.taxInclusivePricing} onChange={(e) => setSettings((p) => ({ ...p, taxInclusivePricing: e.target.checked }))} />Tax Inclusive Pricing</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowManualTaxEntryInPurchases} onChange={(e) => setSettings((p) => ({ ...p, allowManualTaxEntryInPurchases: e.target.checked }))} />Allow Manual Tax Entry in Purchases</label>
            <div className="configuration-actions">
              <PrimaryButton
                className="configuration-save-btn"
                onClick={() =>
                  saveSettings([
                    "enableTax",
                    "defaultTaxRate",
                    "taxInclusivePricing",
                    "allowManualTaxEntryInPurchases"
                  ])
                }
              >
                Save Changes
              </PrimaryButton>
            </div>
          </>
        );
      case "pos":
        return centeredConfigurationForm(
          <>
            <h2 className="section-title">POS Settings</h2>
            <label className="configuration-check"><input type="checkbox" checked={settings.enableBarcodeScanner} onChange={(e) => setSettings((p) => ({ ...p, enableBarcodeScanner: e.target.checked }))} />Enable Barcode Scanner</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowPriceOverride} onChange={(e) => setSettings((p) => ({ ...p, allowPriceOverride: e.target.checked }))} />Allow Price Override</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowDiscountEntry} onChange={(e) => setSettings((p) => ({ ...p, allowDiscountEntry: e.target.checked }))} />Allow Discount Entry</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.autoPrintReceipt} onChange={(e) => setSettings((p) => ({ ...p, autoPrintReceipt: e.target.checked }))} />Auto Print Receipt</label>
            <label className="form-field"><span className="field-label">Default Payment Method</span><select value={settings.defaultPaymentMethod} onChange={(e) => setSettings((p) => ({ ...p, defaultPaymentMethod: e.target.value as SettingsShape["defaultPaymentMethod"] }))}><option value="CASH">Cash</option><option value="GCASH">GCash</option><option value="CARD">Card</option></select></label>
            <label className="configuration-check"><input type="checkbox" checked={settings.requireCustomerBeforeSale} onChange={(e) => setSettings((p) => ({ ...p, requireCustomerBeforeSale: e.target.checked }))} />Require Customer Before Sale</label>
            <div className="configuration-actions">
              <PrimaryButton className="configuration-save-btn" onClick={() => saveSettings(["enableBarcodeScanner", "allowPriceOverride", "allowDiscountEntry", "autoPrintReceipt", "defaultPaymentMethod", "requireCustomerBeforeSale"])}>Save Changes</PrimaryButton>
            </div>
          </>
        );
      case "store":
        return centeredConfigurationForm(
          <>
            <h2 className="section-title">Store Information</h2>
            <label className="form-field"><span className="field-label">Store Name</span><input value={settings.storeName} onChange={(e) => setSettings((p) => ({ ...p, storeName: e.target.value }))} /></label>
            <label className="form-field"><span className="field-label">Business Name</span><input value={settings.businessName} onChange={(e) => setSettings((p) => ({ ...p, businessName: e.target.value }))} /></label>
            <label className="form-field"><span className="field-label">Address</span><textarea rows={2} value={settings.storeAddress} onChange={(e) => setSettings((p) => ({ ...p, storeAddress: e.target.value }))} /></label>
            <label className="form-field"><span className="field-label">Contact Number</span><input value={settings.storeContactNumber} onChange={(e) => setSettings((p) => ({ ...p, storeContactNumber: e.target.value }))} /></label>
            <label className="form-field"><span className="field-label">Email Address</span><input value={settings.storeEmailAddress} onChange={(e) => setSettings((p) => ({ ...p, storeEmailAddress: e.target.value }))} /></label>
            <label className="form-field"><span className="field-label">Logo URL</span><input value={settings.storeLogoUrl} onChange={(e) => setSettings((p) => ({ ...p, storeLogoUrl: e.target.value }))} /></label>
            <label className="form-field"><span className="field-label">Receipt Footer Message</span><textarea rows={2} value={settings.receiptFooterMessage} onChange={(e) => setSettings((p) => ({ ...p, receiptFooterMessage: e.target.value }))} /></label>
            <div className="grid grid-2">
              <label className="form-field"><span className="field-label">TIN</span><input value={settings.tin} onChange={(e) => setSettings((p) => ({ ...p, tin: e.target.value }))} /></label>
              <label className="form-field"><span className="field-label">Permit No.</span><input value={settings.permitNo} onChange={(e) => setSettings((p) => ({ ...p, permitNo: e.target.value }))} /></label>
            </div>
            <div className="configuration-actions">
              <PrimaryButton className="configuration-save-btn" onClick={() => saveSettings(["storeName", "businessName", "storeAddress", "storeContactNumber", "storeEmailAddress", "storeLogoUrl", "receiptFooterMessage", "tin", "permitNo"])}>Save Changes</PrimaryButton>
            </div>
          </>
        );
      case "product":
        return centeredConfigurationForm(
          <>
            <h2 className="section-title">Product Settings</h2>
            <label className="configuration-check"><input type="checkbox" checked={settings.enableProductCategories} onChange={(e) => setSettings((p) => ({ ...p, enableProductCategories: e.target.checked }))} />Enable Product Categories</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.enableCompatibleUnits} onChange={(e) => setSettings((p) => ({ ...p, enableCompatibleUnits: e.target.checked }))} />Enable Compatible Units</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.allowProductPhotoUpload} onChange={(e) => setSettings((p) => ({ ...p, allowProductPhotoUpload: e.target.checked }))} />Allow Product Photo Upload</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.requireSKU} onChange={(e) => setSettings((p) => ({ ...p, requireSKU: e.target.checked }))} />Require SKU</label>
            <label className="configuration-check"><input type="checkbox" checked={settings.autoGenerateSKU} onChange={(e) => setSettings((p) => ({ ...p, autoGenerateSKU: e.target.checked }))} />Auto Generate SKU</label>
            <label className="form-field">
              <span className="field-label">SKU Generation Mode</span>
              <select
                value={settings.skuGenerationMode}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    skuGenerationMode: e.target.value as SettingsShape["skuGenerationMode"]
                  }))
                }
              >
                <option value="MANUAL">Manual</option>
                <option value="GLOBAL">Global</option>
                <option value="CATEGORY_BASED">Category-Based</option>
              </select>
            </label>
            <div className="configuration-actions">
              <PrimaryButton className="configuration-save-btn" onClick={() => saveSettings(["enableProductCategories", "enableCompatibleUnits", "allowProductPhotoUpload", "requireSKU", "autoGenerateSKU", "skuGenerationMode"], "Product settings updated successfully")}>Save Changes</PrimaryButton>
            </div>
          </>
        );
      case "categories":
        return (
          <div className="card">
            <div className="inventory-table-head">
              <h2 className="section-title">Categories</h2>
              <PrimaryButton className="configuration-inline-btn" onClick={openCreateCategory}>
                + Add Category
              </PrimaryButton>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category Code</th>
                    <th>Category Name</th>
                    <th>SKU Prefix</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Products</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.code}</td>
                      <td>{category.name}</td>
                      <td>{category.skuPrefix}</td>
                      <td>
                        <span className={category.status === "ACTIVE" ? "badge purchases-status-posted" : "badge purchases-status-draft"}>
                          {category.status}
                        </span>
                      </td>
                      <td>{category.description || "-"}</td>
                      <td>{category.productCount}</td>
                      <td>
                        <div className="inventory-actions">
                          <button className="btn-secondary" onClick={() => openEditCategory(category)}>
                            Edit
                          </button>
                          <button
                            className={category.status === "ACTIVE" ? "btn-danger" : "btn-success"}
                            onClick={() => toggleCategoryStatus(category)}
                          >
                            {category.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="btn-danger"
                            disabled={category.productCount > 0}
                            onClick={() => deleteCategory(category)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!categories.length ? (
                    <tr>
                      <td colSpan={7} className="muted">
                        No categories yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "system":
        return centeredConfigurationForm(
          <>
            <h2 className="section-title">System Preferences</h2>
            <label className="form-field"><span className="field-label">Currency</span><select value={settings.currency} onChange={(e) => setSettings((p) => ({ ...p, currency: e.target.value as "PHP" }))}><option value="PHP">PHP</option></select></label>
            <label className="form-field"><span className="field-label">Date Format</span><select value={settings.dateFormat} onChange={(e) => setSettings((p) => ({ ...p, dateFormat: e.target.value as SettingsShape["dateFormat"] }))}><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></label>
            <label className="form-field"><span className="field-label">Number Format</span><select value={settings.numberFormat} onChange={(e) => setSettings((p) => ({ ...p, numberFormat: e.target.value as SettingsShape["numberFormat"] }))}><option value="1,000.00">1,000.00</option><option value="1.000,00">1.000,00</option></select></label>
            <label className="form-field"><span className="field-label">Timezone</span><input value={settings.timezone} onChange={(e) => setSettings((p) => ({ ...p, timezone: e.target.value }))} /></label>

            <div className="configuration-theme-block">
              <h3 className="section-title configuration-subtitle">Theme Customization</h3>
              <label className="form-field">
                <span className="field-label">Theme Preset</span>
                <select
                  value={settings.themePreset}
                  onChange={(e) => {
                    const preset = e.target.value as ThemePresetKey;
                    if (preset === "CUSTOM") {
                      setSettings((prev) => ({ ...prev, themePreset: "CUSTOM" }));
                      return;
                    }
                    const colors = themePresets[preset];
                    setSettings((prev) => ({
                      ...prev,
                      themePreset: preset,
                      themePrimaryColor: colors.themePrimaryColor,
                      themeAccentColor: colors.themeAccentColor,
                      themeSidebarActiveColor: colors.themeSidebarActiveColor,
                      themeDangerColor: colors.themeDangerColor
                    }));
                    applyThemeToDocument({
                      themePreset: preset,
                      ...colors
                    });
                  }}
                >
                  {themePresetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="configuration-color-grid">
                <label className="form-field">
                  <span className="field-label">Primary Color</span>
                  <div className="configuration-color-row">
                    <input type="color" value={colorInputValue(settings.themePrimaryColor, defaultThemeValues.themePrimaryColor)} onChange={(e) => updateThemeField("themePrimaryColor", e.target.value)} />
                    <input value={settings.themePrimaryColor} onChange={(e) => updateThemeField("themePrimaryColor", e.target.value)} placeholder="#0F172A" />
                  </div>
                </label>
                <label className="form-field">
                  <span className="field-label">Accent Color</span>
                  <div className="configuration-color-row">
                    <input type="color" value={colorInputValue(settings.themeAccentColor, defaultThemeValues.themeAccentColor)} onChange={(e) => updateThemeField("themeAccentColor", e.target.value)} />
                    <input value={settings.themeAccentColor} onChange={(e) => updateThemeField("themeAccentColor", e.target.value)} placeholder="#2563EB" />
                  </div>
                </label>
                <label className="form-field">
                  <span className="field-label">Sidebar Active Color</span>
                  <div className="configuration-color-row">
                    <input type="color" value={colorInputValue(settings.themeSidebarActiveColor, defaultThemeValues.themeSidebarActiveColor)} onChange={(e) => updateThemeField("themeSidebarActiveColor", e.target.value)} />
                    <input value={settings.themeSidebarActiveColor} onChange={(e) => updateThemeField("themeSidebarActiveColor", e.target.value)} placeholder="#1E3A8A" />
                  </div>
                </label>
                <label className="form-field">
                  <span className="field-label">Danger Color</span>
                  <div className="configuration-color-row">
                    <input type="color" value={colorInputValue(settings.themeDangerColor, defaultThemeValues.themeDangerColor)} onChange={(e) => updateThemeField("themeDangerColor", e.target.value)} />
                    <input value={settings.themeDangerColor} onChange={(e) => updateThemeField("themeDangerColor", e.target.value)} placeholder="#DC2626" />
                  </div>
                </label>
              </div>

              <div
                className="configuration-theme-preview"
                style={
                  {
                    "--preview-primary": settings.themePrimaryColor,
                    "--preview-accent": settings.themeAccentColor,
                    "--preview-sidebar": settings.themeSidebarActiveColor,
                    "--preview-danger": settings.themeDangerColor
                  } as CSSProperties
                }
              >
                <button type="button" className="configuration-preview-btn configuration-preview-primary">Primary Button</button>
                <div className="configuration-preview-tab">Active Tab</div>
                <div className="configuration-preview-sidebar">Active Sidebar Item</div>
                <button type="button" className="configuration-preview-btn configuration-preview-danger">Danger Button</button>
              </div>
            </div>

            <div className="configuration-actions configuration-actions-split">
              <div className="row">
                <SecondaryButton className="configuration-inline-btn" onClick={applyThemePreview}>Preview Theme</SecondaryButton>
                <SecondaryButton className="configuration-inline-btn" onClick={resetThemeToDefault}>Reset to Default</SecondaryButton>
              </div>
              <PrimaryButton className="configuration-save-btn" onClick={saveSystemSettings}>Save Changes</PrimaryButton>
            </div>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="grid">
      <div className="card configuration-tabs-card">
        <div className="configuration-tabs">
          {tabMeta.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "configuration-tab active" : "configuration-tab"}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {renderContent()}

      {userOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <h3 className="section-title">{userMode === "create" ? "Add User" : "Update User"}</h3>
            <div className="stack">
              <label className="form-field"><span className="field-label">Full Name</span><input value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label className="form-field"><span className="field-label">Username</span><input value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} /></label>
              <label className="form-field"><span className="field-label">Email Address</span><input value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <div className="grid grid-2">
                <label className="form-field"><span className="field-label">Password</span><input type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} /></label>
                <label className="form-field"><span className="field-label">Confirm Password</span><input type="password" value={userForm.confirmPassword} onChange={(e) => setUserForm((p) => ({ ...p, confirmPassword: e.target.value }))} /></label>
              </div>
              <div className="grid grid-2">
                <label className="form-field"><span className="field-label">Role</span><select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as UserForm["role"] }))}><option value="ADMIN">Admin</option><option value="CASHIER">Cashier</option></select></label>
                <label className="form-field"><span className="field-label">Status</span><select value={userForm.status} onChange={(e) => setUserForm((p) => ({ ...p, status: e.target.value as UserStatus }))}><option value={UserStatus.ACTIVE}>Active</option><option value={UserStatus.INACTIVE}>Inactive</option></select></label>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton onClick={() => setUserOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveUser}>Save User</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {categoryOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <h3 className="section-title">{categoryMode === "create" ? "Add Category" : "Edit Category"}</h3>
            <div className="stack">
              <label className="form-field">
                <span className="field-label">Category Name</span>
                <input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <div className="grid grid-2">
                <label className="form-field">
                  <span className="field-label">Category Code</span>
                  <input
                    value={categoryForm.code}
                    onChange={(e) =>
                      setCategoryForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                    }
                  />
                </label>
                <label className="form-field">
                  <span className="field-label">SKU Prefix</span>
                  <input
                    value={categoryForm.skuPrefix}
                    onChange={(e) =>
                      setCategoryForm((p) => ({ ...p, skuPrefix: e.target.value.toUpperCase() }))
                    }
                  />
                  <div className="field-help">
                    SKU preview: {(categoryForm.skuPrefix || "CAT").toUpperCase()}-0001
                  </div>
                </label>
              </div>
              <label className="form-field">
                <span className="field-label">Description</span>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <div className="grid grid-2">
                <label className="form-field">
                  <span className="field-label">Status</span>
                  <select
                    value={categoryForm.status}
                    onChange={(e) =>
                      setCategoryForm((p) => ({ ...p, status: e.target.value as CategoryForm["status"] }))
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="field-label">Sort Order</span>
                  <input
                    type="number"
                    value={categoryForm.sortOrder}
                    onChange={(e) =>
                      setCategoryForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton onClick={() => setCategoryOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveCategory}>Save Category</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
