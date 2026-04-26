"use client";

import { Role, UserStatus } from "@prisma/client";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { PencilIcon, TrashIcon } from "@/components/ui/app-icons";
import { useToast } from "@/components/toast-provider";
import {
  applyThemeToDocument,
  defaultThemeValues,
  isValidHexColor,
  ThemePresetKey,
  themePresets
} from "@/lib/theme";
import type { PrintMode } from "@/lib/print-service";

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

type UomRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
};

type UomForm = {
  code: string;
  name: string;
  isActive: boolean;
};

type LoginCarouselImageSetting = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
};

type SettingsShape = {
  allowNegativeStock: boolean;
  lowStockThreshold: number;
  allowManualStockAdjustments: boolean;
  allowProductDeletion: boolean;
  enableLowStockAlerts: boolean;
  inventoryValuationMethod: "STANDARD" | "FIFO";
  enableTax: boolean;
  defaultTaxRate: number;
  taxLabel: string;
  taxInclusivePricing: boolean;
  allowManualTaxEntryInPurchases: boolean;
  enableBarcodeScanner: boolean;
  allowPriceOverride: boolean;
  allowDiscountEntry: boolean;
  autoPrintReceipt: boolean;
  printMode: PrintMode;
  androidBridgeUrl: string;
  androidBridgeToken: string;
  enableBrowserPrintFallback: boolean;
  showCashierName: boolean;
  showChangeAmount: boolean;
  defaultPaymentMethod: "CASH" | "GCASH" | "CARD";
  productDisplayMode: "tile" | "line";
  posProductsPerPage: number;
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
  autoGenerateSKU: boolean;
  currency: "PHP";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  numberFormat: "1,000.00" | "1.000,00";
  timezone: string;
  loginCarouselImages: LoginCarouselImageSetting[];
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
  inventoryValuationMethod: "STANDARD",
  enableTax: true,
  defaultTaxRate: 12,
  taxLabel: "VAT",
  taxInclusivePricing: false,
  allowManualTaxEntryInPurchases: true,
  enableBarcodeScanner: true,
  allowPriceOverride: false,
  allowDiscountEntry: true,
  autoPrintReceipt: false,
  printMode: process.env.NEXT_PUBLIC_PRINT_BRIDGE_TOKEN ? "windows-bridge" : "browser",
  androidBridgeUrl: "http://127.0.0.1:17890",
  androidBridgeToken: "",
  enableBrowserPrintFallback: true,
  showCashierName: true,
  showChangeAmount: true,
  defaultPaymentMethod: "CASH",
  productDisplayMode: "tile",
  posProductsPerPage: 50,
  storeName: "MicroBiz POS",
  businessName: "",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "",
  tin: "",
  permitNo: "",
  enableProductCategories: true,
  enableCompatibleUnits: true,
  allowProductPhotoUpload: true,
  autoGenerateSKU: false,
  currency: "PHP",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,000.00",
  timezone: "Asia/Manila",
  loginCarouselImages: [],
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

const emptyUomForm: UomForm = {
  code: "",
  name: "",
  isActive: true
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

function createCarouselImageEntry(order: number): LoginCarouselImageSetting {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `login-carousel-${Date.now()}-${order}`,
    url: "",
    alt: "",
    sortOrder: order,
    isActive: true
  };
}

function normalizeCarouselImages(images: LoginCarouselImageSetting[]) {
  return [...images]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((image, index) => ({
      ...image,
      id: image.id || `login-carousel-${index + 1}`,
      url: image.url.trim(),
      alt: image.alt.trim(),
      sortOrder: index
    }));
}

function isLikelyImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return /\.(avif|gif|jpe?g|png|svg|webp|bmp|ico)$/i.test(url.pathname) || url.search.length > 0;
  } catch {
    return false;
  }
}

const themePresetOptions: Array<{ value: ThemePresetKey; label: string }> = [
  { value: "DEFAULT_NAVY", label: "Default Navy" },
  { value: "MODERN_BLUE", label: "Modern Blue" },
  { value: "FOREST_GREEN", label: "Forest Green" },
  { value: "ELEGANT_PURPLE", label: "Elegant Purple" },
  { value: "WARM_ORANGE", label: "Warm Orange" },
  { value: "CUSTOM", label: "Custom" }
];

const productSettingItems: Array<{
  key: "enableProductCategories" | "enableCompatibleUnits" | "allowProductPhotoUpload" | "autoGenerateSKU";
  title: string;
  description: string;
}> = [
  {
    key: "enableProductCategories",
    title: "Enable Product Categories",
    description: "Organize products by category."
  },
  {
    key: "enableCompatibleUnits",
    title: "Enable Compatible Units",
    description: "Allow assigning compatible units for cashier reference."
  },
  {
    key: "allowProductPhotoUpload",
    title: "Allow Product Photo Upload",
    description: "Enable image uploads for inventory items."
  },
  {
    key: "autoGenerateSKU",
    title: "Auto Generate SKU",
    description: "Automatically generate SKU based on category prefix."
  }
];

const posSettingItems: Array<{
  key:
    | "enableBarcodeScanner"
    | "allowPriceOverride"
    | "allowDiscountEntry"
    | "autoPrintReceipt"
    | "showCashierName"
    | "showChangeAmount";
  title: string;
  description: string;
}> = [
  {
    key: "enableBarcodeScanner",
    title: "Enable Barcode Scanner",
    description: "Allow barcode-based item entry in the POS screen."
  },
  {
    key: "allowPriceOverride",
    title: "Allow Price Override",
    description: "Permit authorized users to change item price during sale."
  },
  {
    key: "allowDiscountEntry",
    title: "Allow Discount Entry",
    description: "Allow discount values to be entered during checkout."
  },
  {
    key: "autoPrintReceipt",
    title: "Auto Print Receipt",
    description: "Automatically trigger receipt printing after completed sale."
  },
  {
    key: "showCashierName",
    title: "Show Cashier Name on Receipt",
    description: "Display cashier name on printed receipt."
  },
  {
    key: "showChangeAmount",
    title: "Show Change Amount on Receipt",
    description: "Display customer change amount on printed receipt."
  }
];

const inventorySettingItems: Array<{
  key:
    | "allowNegativeStock"
    | "allowManualStockAdjustments"
    | "allowProductDeletion"
    | "enableLowStockAlerts";
  title: string;
  description: string;
}> = [
  {
    key: "allowNegativeStock",
    title: "Allow Negative Stock",
    description: "Permit stock levels to go below zero during transactions or adjustments."
  },
  {
    key: "allowManualStockAdjustments",
    title: "Allow Manual Stock Adjustments",
    description: "Allow users to manually increase or decrease inventory quantities."
  },
  {
    key: "allowProductDeletion",
    title: "Allow Product Deletion",
    description: "Allow inventory items to be permanently deleted from the system."
  },
  {
    key: "enableLowStockAlerts",
    title: "Enable Low Stock Alerts",
    description: "Notify users when item quantity reaches the configured threshold."
  }
];

const taxSettingItems: Array<{
  key: "enableTax" | "taxInclusivePricing" | "allowManualTaxEntryInPurchases";
  title: string;
  description: string;
}> = [
  {
    key: "enableTax",
    title: "Enable Tax",
    description: "Apply tax computation to sales and purchases."
  },
  {
    key: "taxInclusivePricing",
    title: "Tax Inclusive Pricing",
    description: "Treat entered item prices as already inclusive of tax."
  },
  {
    key: "allowManualTaxEntryInPurchases",
    title: "Allow Manual Tax Entry in Purchases",
    description: "Allow users to manually enter tax values when posting purchases."
  }
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
  const [lowStockThresholdInput, setLowStockThresholdInput] = useState(String(defaultSettings.lowStockThreshold));
  const [users, setUsers] = useState<UserRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [userMode, setUserMode] = useState<"create" | "edit">("create");
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryMode, setCategoryMode] = useState<"create" | "edit">("create");
  const [activeCategory, setActiveCategory] = useState<CategoryRow | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [uomOpen, setUomOpen] = useState(false);
  const [uomMode, setUomMode] = useState<"create" | "edit">("create");
  const [activeUom, setActiveUom] = useState<UomRow | null>(null);
  const [uomForm, setUomForm] = useState<UomForm>(emptyUomForm);
  const loadedTabDataRef = useRef({
    users: false,
    categories: false,
    uoms: false
  });
  const usersRequestRef = useRef<Promise<void> | null>(null);
  const categoriesRequestRef = useRef<Promise<void> | null>(null);
  const uomsRequestRef = useRef<Promise<void> | null>(null);

  const isAdmin = ["OWNER", "MANAGER"].includes(data?.user?.role ?? "");

  async function loadSettings() {
    const response = await fetch("/api/settings");
    const payload = (await response.json()) as SettingsShape;
    setSettings((prev) => ({ ...prev, ...payload }));
    setLowStockThresholdInput(
      Number.isFinite(Number(payload.lowStockThreshold)) ? String(payload.lowStockThreshold) : ""
    );
  }

  async function loadUsers(force = false) {
    if (!force && loadedTabDataRef.current.users) return;
    if (!force && usersRequestRef.current) return usersRequestRef.current;
    usersRequestRef.current = (async () => {
      const response = await fetch("/api/users");
      if (!response.ok) return;
      const payload = await response.json();
      setUsers(payload);
      loadedTabDataRef.current.users = true;
    })().finally(() => {
      usersRequestRef.current = null;
    });
    return usersRequestRef.current;
  }

  async function loadCategories(force = false) {
    if (!force && loadedTabDataRef.current.categories) return;
    if (!force && categoriesRequestRef.current) return categoriesRequestRef.current;
    categoriesRequestRef.current = (async () => {
      const response = await fetch("/api/categories?pageSize=100");
      if (!response.ok) return;
      const payload = (await response.json()) as { items: CategoryRow[] };
      setCategories(payload.items);
      loadedTabDataRef.current.categories = true;
    })().finally(() => {
      categoriesRequestRef.current = null;
    });
    return categoriesRequestRef.current;
  }

  async function loadUoms(force = false) {
    if (!force && loadedTabDataRef.current.uoms) return;
    if (!force && uomsRequestRef.current) return uomsRequestRef.current;
    uomsRequestRef.current = (async () => {
      const response = await fetch("/api/uoms?pageSize=200");
      if (!response.ok) return;
      const payload = (await response.json()) as { items: UomRow[] };
      setUoms(payload.items);
      loadedTabDataRef.current.uoms = true;
    })().finally(() => {
      uomsRequestRef.current = null;
    });
    return uomsRequestRef.current;
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers();
    } else if (activeTab === "categories") {
      void loadCategories();
    } else if (activeTab === "product") {
      void loadUoms();
    }
  }, [activeTab]);

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

  function openCreateUom() {
    setUomMode("create");
    setActiveUom(null);
    setUomForm(emptyUomForm);
    setUomOpen(true);
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

  function openEditUom(uom: UomRow) {
    setUomMode("edit");
    setActiveUom(uom);
    setUomForm({
      code: uom.code,
      name: uom.name,
      isActive: uom.isActive
    });
    setUomOpen(true);
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
    await loadUsers(true);
    const payload = await response.json();
    if (activeUser?.id === data?.user?.id) {
      window.dispatchEvent(
        new CustomEvent("microbiz:user-updated", {
          detail: { name: payload.name ?? userForm.name.trim() }
        })
      );
    }
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
    await loadCategories(true);
    success(categoryMode === "edit" ? "Changes saved successfully" : "Record saved successfully");
  }

  async function saveUom() {
    if (!uomForm.code.trim() || !uomForm.name.trim()) {
      alert("UOM code and name are required.");
      return;
    }

    const endpoint = uomMode === "edit" && activeUom ? `/api/uoms/${activeUom.id}` : "/api/uoms";
    const method = uomMode === "edit" ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: uomForm.code.trim().toUpperCase(),
        name: uomForm.name.trim(),
        isActive: uomForm.isActive,
        sortOrder: activeUom?.sortOrder ?? 0
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to save UOM.");
      return;
    }

    setUomOpen(false);
    await loadUoms(true);
    success(uomMode === "edit" ? "Changes saved successfully" : "Record saved successfully");
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
    await loadCategories(true);
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
    await loadCategories(true);
    success("Deleted successfully");
  }

  async function deleteUom(uom: UomRow) {
    if (!window.confirm(`Delete UOM ${uom.code}?`)) return;
    const response = await fetch(`/api/uoms/${uom.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to delete UOM.");
      return;
    }
    await loadUoms(true);
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
    await loadUsers(true);
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
    setLowStockThresholdInput(
      Number.isFinite(Number(json.lowStockThreshold)) ? String(json.lowStockThreshold) : ""
    );
    window.dispatchEvent(new Event("microbiz:settings-updated"));
    success(successMessage);
  }

  async function testAndroidBridge() {
    try {
      const url = (settings.androidBridgeUrl || "http://127.0.0.1:17890").replace(/\/+$/, "");
      const response = await fetch(`${url}/health`, { method: "GET" });
      if (!response.ok) {
        const fallbackResponse = await fetch(`${url}/status`, { method: "GET" });
        if (!fallbackResponse.ok) {
          throw new Error(`Bridge returned HTTP ${fallbackResponse.status}`);
        }
      }
      success("Android bridge is reachable.");
    } catch (bridgeError) {
      alert(
        bridgeError instanceof Error
          ? `Android bridge test failed: ${bridgeError.message}`
          : "Android bridge test failed."
      );
    }
  }

  function updateLowStockThresholdInput(value: string) {
    if (!/^\d*$/.test(value)) return;
    setLowStockThresholdInput(value);
  }

  async function saveInventorySettings() {
    const parsedLowStockThreshold =
      lowStockThresholdInput.trim() === "" ? 0 : Number(lowStockThresholdInput);
    if (!Number.isFinite(parsedLowStockThreshold)) {
      alert("Low Stock Threshold must be a numeric value.");
      return;
    }

    const nextSettings = {
      ...settings,
      lowStockThreshold: parsedLowStockThreshold
    };
    setSettings(nextSettings);

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowNegativeStock: nextSettings.allowNegativeStock,
        lowStockThreshold: nextSettings.lowStockThreshold,
        allowManualStockAdjustments: nextSettings.allowManualStockAdjustments,
        allowProductDeletion: nextSettings.allowProductDeletion,
        enableLowStockAlerts: nextSettings.enableLowStockAlerts,
        inventoryValuationMethod: nextSettings.inventoryValuationMethod
      })
    });
    if (!response.ok) {
      alert("Failed to save configuration.");
      return;
    }

    const json = (await response.json()) as SettingsShape;
    setSettings((prev) => ({ ...prev, ...json }));
    setLowStockThresholdInput(
      Number.isFinite(Number(json.lowStockThreshold)) ? String(json.lowStockThreshold) : ""
    );
    window.dispatchEvent(new Event("microbiz:settings-updated"));
    success("Changes saved successfully");
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
    const invalidCarouselImage = settings.loginCarouselImages.find(
      (image) => image.url.trim() && !isLikelyImageUrl(image.url)
    );
    if (invalidCarouselImage) {
      alert("Each login carousel entry must use a direct image URL.");
      return;
    }
    await saveSettings([
      "currency",
      "dateFormat",
      "numberFormat",
      "timezone",
      "loginCarouselImages",
      "themePreset",
      "themePrimaryColor",
      "themeAccentColor",
      "themeSidebarActiveColor",
      "themeDangerColor"
    ]);
    applyThemePreview();
  }

  function updateCarouselImage(
    imageId: string,
    field: keyof Pick<LoginCarouselImageSetting, "url" | "alt" | "sortOrder" | "isActive">,
    value: string | number | boolean
  ) {
    setSettings((prev) => ({
      ...prev,
      loginCarouselImages: normalizeCarouselImages(
        prev.loginCarouselImages.map((image) =>
          image.id === imageId ? { ...image, [field]: value } : image
        )
      )
    }));
  }

  function addCarouselImage() {
    setSettings((prev) => ({
      ...prev,
      loginCarouselImages: normalizeCarouselImages([
        ...prev.loginCarouselImages,
        createCarouselImageEntry(prev.loginCarouselImages.length)
      ])
    }));
  }

  function removeCarouselImage(imageId: string) {
    setSettings((prev) => ({
      ...prev,
      loginCarouselImages: normalizeCarouselImages(
        prev.loginCarouselImages.filter((image) => image.id !== imageId)
      )
    }));
  }

  function moveCarouselImage(imageId: string, direction: -1 | 1) {
    setSettings((prev) => {
      const nextImages = normalizeCarouselImages(prev.loginCarouselImages);
      const currentIndex = nextImages.findIndex((image) => image.id === imageId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= nextImages.length) {
        return prev;
      }

      const reordered = [...nextImages];
      const [currentImage] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, currentImage);

      return {
        ...prev,
        loginCarouselImages: normalizeCarouselImages(reordered)
      };
    });
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
        return (
          <>
            {centeredConfigurationForm(
              <div className="configuration-product-shell">
                <div className="configuration-product-head">
                  <div>
                    <h2 className="section-title">Inventory Controls</h2>
                    <div className="field-help">
                      Configure stock handling rules, alert behavior, and inventory valuation preferences.
                    </div>
                  </div>
                </div>

                <div className="configuration-product-list">
                  {inventorySettingItems.map((item) => (
                    <label key={item.key} className="configuration-setting-row">
                      <div className="configuration-setting-control">
                        <input
                          type="checkbox"
                          checked={settings[item.key]}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              [item.key]: e.target.checked
                            }))
                          }
                        />
                      </div>
                      <div className="configuration-setting-copy">
                        <span className="configuration-setting-title">{item.title}</span>
                        <span className="configuration-setting-description">{item.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="configuration-subsection configuration-inventory-subsection">
                  <div className="configuration-subsection-head">
                    <h3 className="section-title configuration-subtitle">Inventory Valuation & Alerts</h3>
                    <div className="field-help">
                      Set the valuation method and the low stock level used for inventory monitoring.
                    </div>
                  </div>
                  <div className="configuration-inline-grid">
                    <label className="form-field configuration-select-field">
                      <span className="field-label">Inventory Valuation Method</span>
                      <select
                        value={settings.inventoryValuationMethod}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            inventoryValuationMethod: e.target.value as SettingsShape["inventoryValuationMethod"]
                          }))
                        }
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="FIFO">FIFO</option>
                      </select>
                    </label>
                    <label className="form-field configuration-threshold-field">
                      <span className="field-label">Low Stock Alert Threshold</span>
                      <div className="configuration-threshold-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          value={lowStockThresholdInput}
                          onChange={(e) => updateLowStockThresholdInput(e.target.value)}
                        />
                        <span className="configuration-threshold-unit">items</span>
                      </div>
                      <span className="field-help">
                        Trigger low stock alerts when available quantity reaches this level.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            <div className="configuration-form-shell configuration-product-page-actions-shell">
              <div className="configuration-form-card">
                <div className="configuration-actions configuration-product-page-actions">
                  <PrimaryButton className="configuration-save-btn" onClick={() => void saveInventorySettings()}>
                    Save Changes
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </>
        );
      case "tax":
        return (
          <>
            {centeredConfigurationForm(
              <div className="configuration-product-shell">
                <div className="configuration-product-head">
                  <div>
                    <h2 className="section-title">Tax Settings</h2>
                    <div className="field-help">
                      Configure how taxes are calculated, labeled, and applied across sales and purchases.
                    </div>
                  </div>
                </div>
                <div className="configuration-product-list">
                  {taxSettingItems.map((item) => (
                    <label key={item.key} className="configuration-setting-row">
                      <div className="configuration-setting-control">
                        <input
                          type="checkbox"
                          checked={settings[item.key]}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              [item.key]: e.target.checked
                            }))
                          }
                        />
                      </div>
                      <div className="configuration-setting-copy">
                        <span className="configuration-setting-title">{item.title}</span>
                        <span className="configuration-setting-description">{item.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="configuration-subsection configuration-tax-subsection">
                  <div className="configuration-subsection-head">
                    <h3 className="section-title configuration-subtitle">Tax Defaults</h3>
                    <div className="field-help">
                      Set the standard rate and label used when tax is enabled in the system.
                    </div>
                  </div>
                  <div className="configuration-inline-grid configuration-tax-grid">
                    <label className="form-field configuration-tax-rate-field">
                      <span className="field-label">Default Tax Rate (%)</span>
                      <input
                        type="number"
                        value={settings.defaultTaxRate}
                        onChange={(e) =>
                          setSettings((p) => ({ ...p, defaultTaxRate: Number(e.target.value) }))
                        }
                      />
                      <span className="field-help">
                        Standard tax rate applied when tax is enabled.
                      </span>
                    </label>
                    <label className="form-field configuration-tax-label-field">
                      <span className="field-label">Tax Label</span>
                      <input
                        value={settings.taxLabel}
                        onChange={(e) => setSettings((p) => ({ ...p, taxLabel: e.target.value }))}
                      />
                      <span className="field-help">
                        Short label shown in receipts and sales summaries.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            <div className="configuration-form-shell configuration-product-page-actions-shell">
              <div className="configuration-form-card">
                <div className="configuration-actions configuration-product-page-actions">
                  <PrimaryButton
                    className="configuration-save-btn"
                    onClick={() =>
                      saveSettings([
                        "enableTax",
                        "defaultTaxRate",
                        "taxLabel",
                        "taxInclusivePricing",
                        "allowManualTaxEntryInPurchases"
                      ])
                    }
                  >
                    Save Changes
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </>
        );
      case "pos":
        return (
          <>
            {centeredConfigurationForm(
              <div className="configuration-product-shell">
                <div className="configuration-product-head">
                  <div>
                    <h2 className="section-title">POS Settings</h2>
                    <div className="field-help">
                      Configure cashier workflow behavior, receipt display options, and checkout defaults.
                    </div>
                  </div>
                </div>

                <div className="configuration-product-list">
                  {posSettingItems.map((item) => (
                    <label key={item.key} className="configuration-setting-row">
                      <div className="configuration-setting-control">
                        <input
                          type="checkbox"
                          checked={settings[item.key]}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              [item.key]: e.target.checked
                            }))
                          }
                        />
                      </div>
                      <div className="configuration-setting-copy">
                        <span className="configuration-setting-title">{item.title}</span>
                        <span className="configuration-setting-description">{item.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="configuration-pos-payment-block">
                  <div className="configuration-uom-copy">
                    <h3 className="section-title configuration-subtitle">Receipt Printing</h3>
                    <div className="field-help">
                      Choose how POS receipts are sent. Windows local bridge settings remain separate from Android ESC/POS bridge settings.
                    </div>
                  </div>
                  <div className="configuration-inline-grid configuration-tax-grid">
                    <label className="form-field configuration-pos-payment-field">
                      <span className="field-label">Print Mode</span>
                      <select
                        value={settings.printMode}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            printMode: e.target.value as PrintMode
                          }))
                        }
                      >
                        <option value="browser">Browser Print</option>
                        <option value="windows-bridge">Windows Local Bridge</option>
                        <option value="android-escpos-bridge">Android ESC/POS Bridge</option>
                      </select>
                    </label>
                    <label className="form-field configuration-pos-payment-field">
                      <span className="field-label">Android Bridge URL</span>
                      <input
                        value={settings.androidBridgeUrl}
                        placeholder="http://127.0.0.1:17890"
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            androidBridgeUrl: e.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="form-field configuration-pos-payment-field">
                      <span className="field-label">Android Bridge Token</span>
                      <input
                        value={settings.androidBridgeToken}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            androidBridgeToken: e.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="configuration-setting-row">
                      <div className="configuration-setting-control">
                        <input
                          type="checkbox"
                          checked={settings.enableBrowserPrintFallback}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              enableBrowserPrintFallback: e.target.checked
                            }))
                          }
                        />
                      </div>
                      <div className="configuration-setting-copy">
                        <span className="configuration-setting-title">Enable Browser Print Fallback</span>
                        <span className="configuration-setting-description">
                          Open browser print only when the selected bridge mode fails.
                        </span>
                      </div>
                    </label>
                    <SecondaryButton className="configuration-inline-btn" onClick={testAndroidBridge}>
                      Test Android Bridge
                    </SecondaryButton>
                  </div>
                </div>

                <div className="configuration-pos-payment-block">
                  <div className="configuration-uom-copy">
                    <h3 className="section-title configuration-subtitle">Checkout Defaults</h3>
                    <div className="field-help">
                      Set the default payment option that appears first when starting a new sale.
                    </div>
                  </div>
                  <label className="form-field configuration-pos-payment-field">
                    <span className="field-label">Default Payment Method</span>
                    <select
                      value={settings.defaultPaymentMethod}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          defaultPaymentMethod: e.target.value as SettingsShape["defaultPaymentMethod"]
                        }))
                      }
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="CARD">Card</option>
                    </select>
                  </label>
                </div>

                <div className="configuration-pos-payment-block">
                  <div className="configuration-uom-copy">
                    <h3 className="section-title configuration-subtitle">Product List Display</h3>
                    <div className="field-help">
                      Control how products appear in POS and how many filtered items are shown per page.
                    </div>
                  </div>
                  <div className="configuration-inline-grid configuration-tax-grid">
                    <label className="form-field configuration-pos-payment-field">
                      <span className="field-label">Product Display Mode</span>
                      <select
                        value={settings.productDisplayMode}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            productDisplayMode: e.target.value as SettingsShape["productDisplayMode"]
                          }))
                        }
                      >
                        <option value="tile">Tile</option>
                        <option value="line">Line</option>
                      </select>
                    </label>
                    <label className="form-field configuration-pos-payment-field">
                      <span className="field-label">Products Per Page</span>
                      <select
                        value={String(settings.posProductsPerPage)}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            posProductsPerPage: Number(e.target.value)
                          }))
                        }
                      >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}
            <div className="configuration-form-shell configuration-product-page-actions-shell">
              <div className="configuration-form-card">
                <div className="configuration-actions configuration-product-page-actions">
                  <PrimaryButton
                    className="configuration-save-btn"
                    onClick={() =>
                      saveSettings([
                        "enableBarcodeScanner",
                        "allowPriceOverride",
                        "allowDiscountEntry",
                        "autoPrintReceipt",
                        "printMode",
                        "androidBridgeUrl",
                        "androidBridgeToken",
                        "enableBrowserPrintFallback",
                        "showCashierName",
                        "showChangeAmount",
                        "defaultPaymentMethod",
                        "productDisplayMode",
                        "posProductsPerPage"
                      ])
                    }
                  >
                    Save Changes
                  </PrimaryButton>
                </div>
              </div>
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
        return (
          <>
            {centeredConfigurationForm(
              <div className="configuration-product-shell">
                <div className="configuration-product-head">
                  <div>
                    <h2 className="section-title">General Product Settings</h2>
                    <div className="field-help">
                      Configure core product behavior used across inventory creation, cashier workflows, and SKU setup.
                    </div>
                  </div>
                </div>

                <div className="configuration-product-list">
                  {productSettingItems.map((item) => (
                    <label key={item.key} className="configuration-setting-row">
                      <div className="configuration-setting-control">
                        <input
                          type="checkbox"
                          checked={settings[item.key]}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              [item.key]: e.target.checked
                            }))
                          }
                        />
                      </div>
                      <div className="configuration-setting-copy">
                        <span className="configuration-setting-title">{item.title}</span>
                        <span className="configuration-setting-description">{item.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

              </div>
            )}
            {centeredConfigurationForm(
              <div className="configuration-uom-card">
                <div className="inventory-table-head configuration-uom-head">
                  <div className="configuration-uom-copy">
                    <h2 className="section-title">Units of Measure (UOM Management)</h2>
                    <div className="field-help">
                      Standardize how products are labeled across Inventory and displayed on POS item cards.
                    </div>
                  </div>
                  <PrimaryButton className="configuration-inline-btn" onClick={openCreateUom}>
                    + Add UOM
                  </PrimaryButton>
                </div>
                <div className="table-wrap configuration-uom-table">
                  <table>
                    <colgroup>
                      <col className="configuration-uom-col-code" />
                      <col className="configuration-uom-col-name" />
                      <col className="configuration-uom-col-status" />
                      <col className="configuration-uom-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uoms.map((uom) => (
                        <tr key={uom.id}>
                          <td>{uom.code}</td>
                          <td>{uom.name}</td>
                          <td>
                            <span className={uom.isActive ? "badge purchases-status-posted" : "badge purchases-status-draft"}>
                              {uom.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="actions-cell configuration-uom-actions-cell">
                            <div className="inventory-actions configuration-uom-actions">
                              <button
                                type="button"
                                className="icon-action-btn"
                                aria-label={`Edit ${uom.code}`}
                                onClick={() => {
                                  openEditUom(uom);
                                }}
                              >
                                <PencilIcon className="icon-action-svg" />
                              </button>
                              <button
                                type="button"
                                className="icon-action-btn configuration-uom-delete-btn"
                                aria-label={`Delete ${uom.code}`}
                                disabled={uom.productCount > 0}
                                onClick={() => {
                                  void deleteUom(uom);
                                }}
                              >
                                <TrashIcon className="icon-action-svg" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!uoms.length ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="configuration-uom-empty">
                              <strong>No units of measure yet.</strong>
                              <span>
                                Start by adding units like PCS, BOX, L, or SET to standardize inventory and POS display.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="configuration-form-shell configuration-product-page-actions-shell">
              <div className="configuration-form-card">
                <div className="configuration-actions configuration-product-page-actions">
                  <PrimaryButton
                    className="configuration-save-btn"
                    onClick={() =>
                      saveSettings(
                        [
                          "enableProductCategories",
                          "enableCompatibleUnits",
                          "allowProductPhotoUpload",
                          "autoGenerateSKU"
                        ],
                        "Product settings updated successfully"
                      )
                    }
                  >
                    Save Changes
                  </PrimaryButton>
                </div>
              </div>
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
              <div className="configuration-block-head">
                <div>
                  <h3 className="section-title configuration-subtitle">Login Carousel Images</h3>
                  <div className="field-help">Add direct image URLs to display on the login page carousel.</div>
                </div>
                <SecondaryButton className="configuration-inline-btn" onClick={addCarouselImage}>+ Add Image</SecondaryButton>
              </div>

              <div className="configuration-carousel-list">
                {settings.loginCarouselImages.map((image, index) => {
                  const hasUrl = image.url.trim().length > 0;
                  const urlLooksValid = !hasUrl || isLikelyImageUrl(image.url);

                  return (
                    <div key={image.id} className="configuration-carousel-item">
                      <div className="configuration-carousel-thumb-shell">
                        {hasUrl && urlLooksValid ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image.url}
                            alt={image.alt || `Carousel preview ${index + 1}`}
                            className="configuration-carousel-thumb"
                          />
                        ) : (
                          <div className="configuration-carousel-thumb configuration-carousel-thumb-empty">
                            Preview
                          </div>
                        )}
                      </div>

                      <div className="configuration-carousel-fields">
                        <div className="grid grid-2">
                          <label className="form-field">
                            <span className="field-label">Image URL</span>
                            <input
                              value={image.url}
                              placeholder="https://example.com/slide.jpg"
                              onChange={(e) => updateCarouselImage(image.id, "url", e.target.value)}
                            />
                            {!urlLooksValid ? <div className="field-help configuration-warning-text">Use a direct image URL ending in jpg, png, svg, webp, or similar.</div> : null}
                          </label>
                          <label className="form-field">
                            <span className="field-label">Alt Text / Label</span>
                            <input
                              value={image.alt}
                              placeholder="Optional description"
                              onChange={(e) => updateCarouselImage(image.id, "alt", e.target.value)}
                            />
                          </label>
                        </div>

                        <div className="configuration-carousel-meta">
                          <label className="form-field configuration-carousel-order">
                            <span className="field-label">Display Order</span>
                            <input
                              type="number"
                              min={0}
                              value={image.sortOrder}
                              onChange={(e) =>
                                updateCarouselImage(
                                  image.id,
                                  "sortOrder",
                                  Number(e.target.value) || 0
                                )
                              }
                            />
                          </label>
                          <label className="configuration-check">
                            <input
                              type="checkbox"
                              checked={image.isActive}
                              onChange={(e) => updateCarouselImage(image.id, "isActive", e.target.checked)}
                            />
                            Active
                          </label>
                          <div className="configuration-carousel-actions">
                            <SecondaryButton
                              className="configuration-inline-btn"
                              onClick={() => moveCarouselImage(image.id, -1)}
                            >
                              Up
                            </SecondaryButton>
                            <SecondaryButton
                              className="configuration-inline-btn"
                              onClick={() => moveCarouselImage(image.id, 1)}
                            >
                              Down
                            </SecondaryButton>
                            <button
                              type="button"
                              className="btn-danger configuration-inline-btn"
                              onClick={() => removeCarouselImage(image.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!settings.loginCarouselImages.length ? (
                  <div className="configuration-carousel-empty">
                    No custom login carousel images yet. The login page will use default placeholder slides until you add some.
                  </div>
                ) : null}
              </div>
            </div>

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

      {uomOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <h3 className="section-title">{uomMode === "create" ? "Add UOM" : "Edit UOM"}</h3>
            <div className="stack">
              <div className="grid grid-2">
          <label className="form-field">
            <span className="field-label">Code</span>
            <input
              value={uomForm.code}
              onChange={(e) => setUomForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            />
          </label>
          <label className="form-field">
            <span className="field-label">Name</span>
            <input
              value={uomForm.name}
              onChange={(e) => setUomForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
              </div>
        <div className="form-field">
          <span className="field-label">Status</span>
  <label className="configuration-check configuration-check-reverse">
    <span>Active</span>
    <input
      className="configuration-check-lg"
      type="checkbox"
      checked={uomForm.isActive}
      onChange={(e) => setUomForm((p) => ({ ...p, isActive: e.target.checked }))}
    />
  </label>
        </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton onClick={() => setUomOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveUom}>Save UOM</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
