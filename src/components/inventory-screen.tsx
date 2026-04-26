"use client";

import { ChangeEvent, DragEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { useToast } from "@/components/toast-provider";
import { MoreVerticalIcon, PencilIcon } from "@/components/ui/app-icons";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  normalizeDecimalInput,
  normalizeIntegerInput,
  sanitizeDecimalInput,
  sanitizeIntegerInput
} from "@/lib/numeric-input";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  categoryId?: string | null;
  uomId?: string | null;
  uomCode?: string | null;
  uomName?: string | null;
  category: string;
  description: string;
  compatibleUnits: string;
  barcode?: string | null;
  photoUrl: string | null;
  unit: string;
  unitCost: number;
  sellingPrice: number;
  costPrice: number;
  stockQty: number;
  allowNegativeStock: boolean;
  isActive: boolean;
  lowStockThreshold: number;
};
type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type InventoryMetrics = {
  totalItems: number;
  lowStockItems: number;
  availableCategories: number;
  inventoryValue: number;
};
type CategoryOption = {
  id: string;
  name: string;
  code: string;
  skuPrefix: string;
  status: "ACTIVE" | "INACTIVE";
};
type UomOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  productCount?: number;
};
type InventoryImportPreviewRow = {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  unitCost: number | null;
  price: number | null;
  stockQty: number | null;
  compatibleUnits: string;
  isActive: boolean;
  errors: string[];
};
type InventoryImportSummary = {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
};
type ProductHistoryRow = {
  id: string;
  date: string;
  type: string;
  quantityChange: number;
  reference: string;
};
type ActionsMenuState = {
  productId: string;
  top: number;
  left: number;
};

type SortKey = "name" | "sku" | "category" | "stockQty" | "unitCost" | "sellingPrice";
type InventoryFilter = "active" | "archived" | "all";
type ProductBehaviorSettings = {
  enableProductCategories: boolean;
  enableCompatibleUnits: boolean;
  allowProductPhotoUpload: boolean;
  autoGenerateSKU: boolean;
  allowNegativeStock: boolean;
  lowStockThreshold: number;
  allowManualStockAdjustments: boolean;
  allowProductDeletion: boolean;
  enableLowStockAlerts: boolean;
};

function sanitizeSignedAdjustmentInput(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  const hasLeadingMinus = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/-/g, "");
  const cleaned = unsigned.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const normalized =
    firstDot === -1
      ? cleaned
      : `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;
  return hasLeadingMinus ? `-${normalized}` : normalized;
}

function parseAdjustmentQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const defaultProductBehaviorSettings: ProductBehaviorSettings = {
  enableProductCategories: true,
  enableCompatibleUnits: true,
  allowProductPhotoUpload: true,
  autoGenerateSKU: false,
  allowNegativeStock: false,
  lowStockThreshold: 10,
  allowManualStockAdjustments: true,
  allowProductDeletion: false,
  enableLowStockAlerts: true
};

export function InventoryScreen({
  initialProducts,
  initialPagination,
  initialMetrics,
  initialCategoryOptions
}: {
  initialProducts: ProductRow[];
  initialPagination: PaginationState;
  initialMetrics: InventoryMetrics;
  initialCategoryOptions: string[];
}) {
  const { data: session } = useSession();
  const { success } = useToast();
  const router = useRouter();
  const isAdmin = ["OWNER", "MANAGER"].includes(session?.user?.role ?? "");
  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState(initialPagination);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [categoryOptions, setCategoryOptions] = useState(initialCategoryOptions);
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);
  const [availableUoms, setAvailableUoms] = useState<UomOption[]>([]);
  const [productSettings, setProductSettings] = useState<ProductBehaviorSettings>(
    defaultProductBehaviorSettings
  );
  const inventoryTableColumns =
    5 +
    (productSettings.allowProductPhotoUpload ? 1 : 0) +
    (productSettings.enableProductCategories ? 1 : 0) +
    2;
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("active");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ProductRow | null>(null);
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraCapturedPreview, setCameraCapturedPreview] = useState<string | null>(null);
  const [cameraCapturedFile, setCameraCapturedFile] = useState<File | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    uomId: "",
    category: "General",
    description: "",
    compatibleUnits: "",
    barcode: "",
    unit: "pc",
    unitCost: 0,
    costPrice: 0,
    sellingPrice: 0,
    stockQty: 0,
    allowNegativeStock: false,
    isActive: true,
    lowStockThreshold: 0
  });
  const [createQtyInput, setCreateQtyInput] = useState("");
  const [createUnitCostInput, setCreateUnitCostInput] = useState("");
  const [createPriceInput, setCreatePriceInput] = useState("");
  const [editUnitCostInput, setEditUnitCostInput] = useState("");
  const [editPriceInput, setEditPriceInput] = useState("");
  const [adjustQtyInput, setAdjustQtyInput] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [skuPreviewError, setSkuPreviewError] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState<InventoryImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<InventoryImportSummary | null>(null);
  const [importRawRows, setImportRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [importingPreview, setImportingPreview] = useState(false);
  const [importingRows, setImportingRows] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<ProductHistoryRow[]>([]);
  const [actionsMenuState, setActionsMenuState] = useState<ActionsMenuState | null>(null);
  const createPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const inventoryRefsLoadedRef = useRef(false);
  const inventoryRefsRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const anyModalOpen =
      createOpen || editOpen || cameraOpen || adjustOpen || importOpen || historyOpen;
    if (!anyModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [adjustOpen, cameraOpen, createOpen, editOpen, historyOpen, importOpen]);

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (cameraCapturedPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(cameraCapturedPreview);
      }
    };
  }, [cameraCapturedPreview]);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (actionsMenuRef.current.contains(event.target as Node)) return;
      setActionsMenuState(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleViewportChange() {
      setActionsMenuState(null);
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, []);

  useEffect(() => {
    if (!productSettings.enableProductCategories) {
      setSelectedCategory("ALL");
    }
  }, [productSettings.enableProductCategories]);

  useEffect(() => {
    if (!createOpen || !productSettings.autoGenerateSKU) {
      setSkuPreviewError("");
      return;
    }
    if (!form.categoryId) {
      setSkuPreviewError("Select a category first to generate SKU.");
      setForm((prev) => ({ ...prev, sku: "" }));
      return;
    }

    let cancelled = false;

    async function loadSkuPreview() {
      const response = await fetch(`/api/products/next-sku?categoryId=${encodeURIComponent(form.categoryId)}`);
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setSkuPreviewError(payload.error ?? "Unable to generate SKU.");
        setForm((prev) => ({ ...prev, sku: "" }));
        return;
      }
      setSkuPreviewError("");
      setForm((prev) => ({ ...prev, sku: payload.sku ?? "" }));
    }

    void loadSkuPreview();
    return () => {
      cancelled = true;
    };
  }, [createOpen, form.categoryId, productSettings.autoGenerateSKU]);

  const refresh = useCallback(
    async (nextPage = page, nextQuery = query) => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({
          filter: inventoryFilter,
          page: String(nextPage),
          pageSize: String(pagination.pageSize),
          sortKey,
          sortDir
        });
        if (nextQuery.trim()) {
          params.set("q", nextQuery.trim());
        }
        if (productSettings.enableProductCategories && selectedCategory !== "ALL") {
          params.set("category", selectedCategory);
        }
        const response = await fetch(`/api/products?${params.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          items: ProductRow[];
          pagination: PaginationState;
          metrics: InventoryMetrics;
          categoryOptions: string[];
        };
        setProducts(payload.items);
        setPagination(payload.pagination);
        setMetrics(payload.metrics);
        setCategoryOptions(payload.categoryOptions);
      } finally {
        setLoadingList(false);
      }
    },
    [inventoryFilter, page, pagination.pageSize, productSettings.enableProductCategories, query, selectedCategory, sortDir, sortKey]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refresh(page, query);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [page, query, inventoryFilter, selectedCategory, sortKey, sortDir, refresh]);

  useEffect(() => {
    let mounted = true;

    async function loadProductSettings() {
      const settingsResponse = await fetch("/api/settings");
      if (!settingsResponse.ok) return;
      const payload = (await settingsResponse.json()) as Partial<ProductBehaviorSettings>;
      if (!mounted) return;
      setProductSettings((prev) => ({ ...prev, ...payload }));
    }

    const handleSettingsUpdated = () => {
      void loadProductSettings();
      if (inventoryRefsLoadedRef.current) {
        void ensureInventoryReferenceData(true);
      }
      void refresh(1, query);
    };
    void loadProductSettings();
    window.addEventListener("microbiz:settings-updated", handleSettingsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("microbiz:settings-updated", handleSettingsUpdated);
    };
  }, [query, refresh]);

  async function ensureInventoryReferenceData(force = false) {
    if (!force && inventoryRefsLoadedRef.current) return;
    if (!force && inventoryRefsRequestRef.current) return inventoryRefsRequestRef.current;

    inventoryRefsRequestRef.current = (async () => {
      const [categoriesResponse, uomsResponse] = await Promise.all([
        fetch("/api/categories?activeOnly=true&pageSize=100"),
        fetch("/api/uoms?pageSize=200")
      ]);
      if (categoriesResponse.ok) {
        const categoriesPayload = (await categoriesResponse.json()) as { items: CategoryOption[] };
        setAvailableCategories(categoriesPayload.items);
      }
      if (uomsResponse.ok) {
        const uomsPayload = (await uomsResponse.json()) as { items: UomOption[] };
        setAvailableUoms(uomsPayload.items);
      }
      inventoryRefsLoadedRef.current = true;
    })().finally(() => {
      inventoryRefsRequestRef.current = null;
    });

    return inventoryRefsRequestRef.current;
  }

  function getStockStatus(item: ProductRow) {
    if (item.stockQty <= 0) {
      return { label: "Out of Stock", className: "inventory-status-out" };
    }
    if (
      productSettings.enableLowStockAlerts &&
      item.stockQty <= Math.max(0, productSettings.lowStockThreshold)
    ) {
      return { label: "Low Stock", className: "inventory-status-low" };
    }
    return { label: "In Stock", className: "inventory-status-in" };
  }

  function openAdjust(product: ProductRow) {
    setActiveProduct(product);
    setAdjustQtyInput("");
    setAdjustReason("");
    setAdjustOpen(true);
  }

  function changeSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setSortDir("asc");
  }

  function resetImportState() {
    setImportFileName("");
    setImportPreviewRows([]);
    setImportSummary(null);
    setImportRawRows([]);
    setImportingPreview(false);
    setImportingRows(false);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  }

  function openImport() {
    resetImportState();
    setImportOpen(true);
  }

  function closeImport() {
    setImportOpen(false);
    resetImportState();
  }

  function triggerImportPicker() {
    importFileInputRef.current?.click();
  }

  function exportInventory() {
    window.location.href = "/api/products/export";
  }

  function downloadImportTemplate() {
    window.location.href = "/api/products/import/template";
  }

  async function previewImportRowsFromFile(
    rows: Array<Record<string, unknown>>,
    fileName: string
  ) {
    setImportingPreview(true);
    try {
      const response = await fetch("/api/products/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error ?? "Failed to preview import file");
        return;
      }
      setImportFileName(fileName);
      setImportRawRows(rows);
      setImportPreviewRows(payload.rows ?? []);
      setImportSummary(payload.summary ?? null);
    } finally {
      setImportingPreview(false);
    }
  }

  async function onImportFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        alert("The selected file does not contain any worksheet data.");
        return;
      }
      const worksheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
      if (!rows.length) {
        alert("The selected file does not contain any inventory rows.");
        return;
      }
      await previewImportRowsFromFile(rows, file.name);
    } catch {
      alert("Failed to read the selected file. Please use a valid Excel or CSV file.");
    }
  }

  async function importInventoryRows() {
    if (!importRawRows.length) {
      alert("Upload a file first.");
      return;
    }
    setImportingRows(true);
    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRawRows })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error ?? "Failed to import inventory");
        return;
      }
      setImportPreviewRows(payload.failures ?? importPreviewRows);
      setImportSummary(payload.summary ?? null);
      await refresh(1, query);
      setPage(1);
      success(
        payload.summary?.successfulRows
          ? `Imported ${payload.summary.successfulRows} item(s) successfully`
          : "No rows were imported"
      );
    } finally {
      setImportingRows(false);
    }
  }

  async function openHistory(product: ProductRow) {
    setActiveProduct(product);
    setHistoryRows([]);
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const response = await fetch(`/api/inventory/history?productId=${encodeURIComponent(product.id)}`);
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error ?? "Failed to load product history");
        setHistoryOpen(false);
        return;
      }
      setHistoryRows((payload.items ?? []) as ProductHistoryRow[]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openInventoryDetails(productId: string) {
    router.push(`/inventory/${productId}`);
  }

  function toggleActionsMenu(event: ReactMouseEvent<HTMLButtonElement>, productId: string) {
    event.stopPropagation();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    setActionsMenuState((current) =>
      current?.productId === productId
        ? null
        : {
            productId,
            top: buttonRect.bottom + 6,
            left: buttonRect.right - 160
          }
    );
  }

  async function openCreate() {
    await ensureInventoryReferenceData();
    setSkuPreviewError("");
    setForm({
      name: "",
      sku: "",
      categoryId: availableCategories[0]?.id ?? "",
      uomId: "",
      category: availableCategories[0]?.name ?? "General",
      description: "",
      compatibleUnits: "",
      barcode: "",
      unit: "pc",
      unitCost: 0,
      costPrice: 0,
      sellingPrice: 0,
      stockQty: 0,
      allowNegativeStock: false,
      isActive: true,
      lowStockThreshold: productSettings.lowStockThreshold
    });
    setCreateQtyInput("");
    setCreateUnitCostInput("");
    setCreatePriceInput("");
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
    setCreateOpen(true);
  }

  async function openEdit(product: ProductRow) {
    await ensureInventoryReferenceData();
    setSkuPreviewError("");
    setActiveProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId ?? "",
      uomId: product.uomId ?? "",
      category: product.category,
      description: product.description,
      compatibleUnits: product.compatibleUnits ?? "",
      barcode: product.barcode ?? "",
      unit: product.unit,
      unitCost: product.unitCost,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      stockQty: product.stockQty,
      allowNegativeStock: product.allowNegativeStock,
      isActive: product.isActive,
      lowStockThreshold: product.lowStockThreshold
    });
    setEditUnitCostInput(String(product.unitCost));
    setEditPriceInput(String(product.sellingPrice));
    setEditPhotoFile(null);
    setEditPhotoPreview(product.photoUrl ?? null);
    setEditOpen(true);
  }

  function setCreatePhotoFromFile(file: File | null) {
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

  function onCreatePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCreatePhotoFromFile(file);
  }

  function clearCreatePhoto() {
    if (createPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(createPhotoPreview);
    }
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
    if (createPhotoInputRef.current) {
      createPhotoInputRef.current.value = "";
    }
  }

  function triggerCreatePhotoPicker() {
    createPhotoInputRef.current?.click();
  }

  async function openCameraModal() {
    if (!cameraSupported) {
      setCameraError("Camera is not supported on this browser or device.");
      return;
    }

    setCameraOpen(true);
    setCameraError("");
    setCameraCapturedFile(null);
    if (cameraCapturedPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(cameraCapturedPreview);
    }
    setCameraCapturedPreview(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
    } catch {
      setCameraError("Camera access was denied or is unavailable. You can still upload a photo.");
    }
  }

  function closeCameraModal() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraError("");
    setCameraCapturedFile(null);
    if (cameraCapturedPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(cameraCapturedPreview);
    }
    setCameraCapturedPreview(null);
  }

  async function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setCameraError("Camera is still initializing. Please try again.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to capture photo.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      setCameraError("Unable to capture photo.");
      return;
    }

    if (cameraCapturedPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(cameraCapturedPreview);
    }

    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setCameraCapturedFile(file);
    setCameraCapturedPreview(URL.createObjectURL(blob));
    setCameraError("");
  }

  function retakeCameraPhoto() {
    setCameraCapturedFile(null);
    if (cameraCapturedPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(cameraCapturedPreview);
    }
    setCameraCapturedPreview(null);
    setCameraError("");
  }

  function useCapturedPhoto() {
    if (!cameraCapturedFile) return;
    setCreatePhotoFromFile(cameraCapturedFile);
    closeCameraModal();
  }

  function handleCreatePhotoDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    setCreatePhotoFromFile(file);
  }

  function clearEditPhoto() {
    if (editPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editPhotoPreview);
    }
    setEditPhotoFile(null);
    setEditPhotoPreview(activeProduct?.photoUrl ?? null);
  }

  async function createProduct() {
    if (!form.name.trim()) {
      alert("Product Name is required");
      return;
    }
    if (productSettings.autoGenerateSKU && !form.categoryId) {
      alert("Category is required before generating SKU.");
      return;
    }
    if (!productSettings.autoGenerateSKU && !form.sku.trim()) {
      alert("SKU is required");
      return;
    }
    if (!createUnitCostInput.trim()) {
      alert("Unit Cost is required");
      return;
    }
    if (!createQtyInput.trim()) {
      alert("Initial Quantity is required");
      return;
    }
    if (!createPriceInput.trim()) {
      alert("Price is required");
      return;
    }

    const unitCost = Number.parseFloat(createUnitCostInput);
    const stockQty = Number.parseInt(createQtyInput, 10);
    const sellingPrice = Number.parseFloat(createPriceInput);

    if (!Number.isFinite(unitCost)) {
      alert("Unit Cost must be numeric");
      return;
    }
    if (unitCost < 0) {
      alert("Unit Cost cannot be negative");
      return;
    }
    if (!Number.isFinite(stockQty)) {
      alert("Initial Quantity must be numeric");
      return;
    }
    if (stockQty < 0) {
      alert("Initial Quantity cannot be negative");
      return;
    }
    if (!Number.isFinite(sellingPrice)) {
      alert("Price must be numeric");
      return;
    }
    if (sellingPrice < 0) {
      alert("Price cannot be negative");
      return;
    }
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        unitCost,
        costPrice: unitCost,
        stockQty,
        sellingPrice
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to create product");
      return;
    }
    const created = await response.json();
    if (productSettings.allowProductPhotoUpload && createPhotoFile) {
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
    success("Item added successfully");
  }

  async function updateProduct() {
    if (!activeProduct) return;
    if (!form.name.trim()) {
      alert("Product Name is required");
      return;
    }
    if (productSettings.autoGenerateSKU && !form.categoryId) {
      alert("Category is required before generating SKU.");
      return;
    }
    if (!productSettings.autoGenerateSKU && !form.sku.trim()) {
      alert("SKU is required");
      return;
    }
    if (!editUnitCostInput.trim()) {
      alert("Unit Cost is required");
      return;
    }
    if (!editPriceInput.trim()) {
      alert("Price is required");
      return;
    }

    const unitCost = Number.parseFloat(editUnitCostInput);
    const sellingPrice = Number.parseFloat(editPriceInput);

    if (!Number.isFinite(sellingPrice)) {
      alert("Price must be numeric");
      return;
    }
    if (sellingPrice < 0) {
      alert("Price cannot be negative");
      return;
    }
    if (!Number.isFinite(unitCost)) {
      alert("Unit Cost must be numeric");
      return;
    }
    if (unitCost < 0) {
      alert("Unit Cost cannot be negative");
      return;
    }
    if (!Number.isFinite(form.stockQty)) {
      alert("Quantity must be numeric");
      return;
    }
    const response = await fetch(`/api/products/${activeProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        unitCost,
        costPrice: unitCost,
        sellingPrice
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to update product");
      return;
    }
    if (productSettings.allowProductPhotoUpload && editPhotoFile) {
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
    success("Item updated successfully");
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
    success("Item deleted successfully");
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
    success("Processed successfully");
  }

  async function restoreProduct(id: string) {
    const response = await fetch(`/api/products/${id}/restore`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json();
      alert(payload.error ?? "Failed to restore item");
      return;
    }
    await refresh();
    success("Processed successfully");
  }

  async function saveAdjustment() {
    if (!activeProduct) return;
    const qtyDelta = parseAdjustmentQuantity(adjustQtyInput);
    if (qtyDelta === null || qtyDelta === 0) {
      alert("Enter a non-zero stock adjustment.");
      return;
    }
    if (!adjustReason.trim()) {
      alert("Adjustment reason is required.");
      return;
    }

    setAdjustSaving(true);
    try {
      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: activeProduct.id,
          qtyDelta,
          reason: adjustReason.trim()
        })
      });
      if (!response.ok) {
        const payload = await response.json();
        alert(payload.error ?? "Failed to adjust stock");
        return;
      }
      setAdjustOpen(false);
      setActiveProduct(null);
      await refresh();
      success("Processed successfully");
    } finally {
      setAdjustSaving(false);
    }
  }

  const adjustmentPreviewQty = parseAdjustmentQuantity(adjustQtyInput);
  const projectedStock =
    activeProduct && adjustmentPreviewQty !== null
      ? Number((activeProduct.stockQty + adjustmentPreviewQty).toFixed(2))
      : null;

  return (
    <div className="inventory-admin">
      <div className="inventory-summary-bar">
        <span className="inventory-summary-item">
          <span className="inventory-summary-label">Total Items:</span>
          <strong>{metrics.totalItems}</strong>
        </span>
        <span className="inventory-summary-divider" aria-hidden>
          |
        </span>
        <span className="inventory-summary-item">
          <span className="inventory-summary-label">Inventory Value:</span>
          <strong>{formatCurrency(metrics.inventoryValue)}</strong>
        </span>
      </div>

      <div className="card">
        <div className="inventory-table-head">
          <div className="inventory-title-group">
            <h2 className="section-title">Inventory</h2>
            {productSettings.enableLowStockAlerts && metrics.lowStockItems > 0 ? (
              <span className="inventory-low-stock-pill">
                Low Stock: {metrics.lowStockItems}
              </span>
            ) : null}
          </div>
          <div className="inventory-header-actions">
            {isAdmin ? (
              <>
                <SecondaryButton className="inventory-action-btn" onClick={openImport}>
                  Import
                </SecondaryButton>
                <SecondaryButton className="inventory-action-btn" onClick={exportInventory}>
                  Export
                </SecondaryButton>
                <PrimaryButton className="inventory-add-btn" onClick={openCreate}>
                  + Add Item
                </PrimaryButton>
              </>
            ) : null}
          </div>
        </div>

        <div className="inventory-toolbar-search">
          <div className="inventory-filter-bar">
            <div className="row inventory-filter-row inventory-status-segment">
              <button
                type="button"
                className={inventoryFilter === "active" ? "configuration-tab active" : "configuration-tab"}
                onClick={() => {
                  setInventoryFilter("active");
                  setPage(1);
                }}
              >
                Active
              </button>
              <button
                type="button"
                className={inventoryFilter === "archived" ? "configuration-tab active" : "configuration-tab"}
                onClick={() => {
                  setInventoryFilter("archived");
                  setPage(1);
                }}
              >
                Archived
              </button>
            </div>
            <div className="inventory-filter-controls">
              <input
                placeholder="Search product name / SKU / barcode"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="inventory-search"
              />
              {productSettings.enableProductCategories ? (
                <select
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value);
                    setPage(1);
                  }}
                  className="inventory-category-select"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {productSettings.allowProductPhotoUpload ? <th>Photo</th> : null}
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
                {productSettings.enableProductCategories ? (
                  <th>
                    <button type="button" className="table-sort-btn" onClick={() => changeSort("category")}>
                      Category
                    </button>
                  </th>
                ) : null}
                <th>
                  <button type="button" className="table-sort-btn" onClick={() => changeSort("stockQty")}>
                    Stock
                  </button>
                </th>
                <th>
                  <button type="button" className="table-sort-btn" onClick={() => changeSort("unitCost")}>
                    Unit Cost
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
                <th className="inventory-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={inventoryTableColumns} className="muted">
                    Loading inventory...
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                const stockStatus = getStockStatus(item);
                return (
                <tr
                  key={item.id}
                  className="inventory-clickable-row"
                  role="link"
                  tabIndex={0}
                  onClick={() => openInventoryDetails(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openInventoryDetails(item.id);
                    }
                  }}
                >
                  {productSettings.allowProductPhotoUpload ? (
                    <td>
                      {item.photoUrl ? (
                        <Image
                          src={item.photoUrl}
                          alt={item.name}
                          width={44}
                          height={44}
                          className="inventory-thumb"
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  {productSettings.enableProductCategories ? <td>{item.category}</td> : null}
                  <td>{formatNumber(item.stockQty)}</td>
                  <td>{formatCurrency(item.unitCost)}</td>
                  <td>{formatCurrency(item.sellingPrice)}</td>
                  <td>
                    <span className={`badge ${stockStatus.className}`}>{stockStatus.label}</span>
                  </td>
                  <td
                    className="actions-cell"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <div className="inventory-actions">
                      <button
                        type="button"
                        className="icon-action-btn"
                        aria-label={`Edit ${item.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setActionsMenuState(null);
                          openEdit(item);
                        }}
                      >
                        <PencilIcon className="icon-action-svg" />
                      </button>
                      <button
                        type="button"
                        className="icon-action-btn"
                        aria-label={`More actions for ${item.name}`}
                        aria-expanded={actionsMenuState?.productId === item.id}
                        onClick={(event) => toggleActionsMenu(event, item.id)}
                      >
                        <MoreVerticalIcon className="icon-action-svg" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              }))}
              {!loadingList && !products.length ? (
                <tr>
                  <td colSpan={inventoryTableColumns} className="muted">
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
            Showing {products.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0} to{" "}
            {(pagination.page - 1) * pagination.pageSize + products.length} of {pagination.total}
          </div>
          <div className="row">
            <button
              className="btn-secondary"
              disabled={pagination.page <= 1 || loadingList}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Prev
            </button>
            <span className="badge">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={pagination.page >= pagination.totalPages || loadingList}
              onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {actionsMenuState ? (
        <div
          ref={actionsMenuRef}
          className="inventory-actions-menu inventory-actions-menu-floating"
          style={{
            top: actionsMenuState.top,
            left: actionsMenuState.left
          }}
        >
          {(() => {
            const menuProduct = products.find((product) => product.id === actionsMenuState.productId);
            if (!menuProduct) return null;
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuState(null);
                    void openHistory(menuProduct);
                  }}
                >
                  History
                </button>
                {productSettings.allowManualStockAdjustments && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionsMenuState(null);
                      openAdjust(menuProduct);
                    }}
                  >
                    Adjust Stock
                  </button>
                ) : null}
                {menuProduct.isActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionsMenuState(null);
                      void archiveProduct(menuProduct.id);
                    }}
                  >
                    Archive Item
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuState(null);
                        void restoreProduct(menuProduct.id);
                      }}
                    >
                      Restore
                    </button>
                    {isAdmin && productSettings.allowProductDeletion ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setActionsMenuState(null);
                          void deleteProduct(menuProduct.id);
                        }}
                      >
                        Permanently Delete
                      </button>
                    ) : null}
                  </>
                )}
              </>
            );
          })()}
        </div>
      ) : null}

      {historyOpen && activeProduct ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal inventory-history-modal inventory-modal-responsive">
            <div className="inventory-modal-header">
              <h3 className="section-title">Item History</h3>
              <div className="muted">
                {activeProduct.name} ({activeProduct.sku})
              </div>
            </div>
            <div className="inventory-modal-body">
              <div className="table-wrap inventory-history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Quantity Change</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan={4} className="muted">
                          Loading history...
                        </td>
                      </tr>
                    ) : historyRows.length ? (
                      historyRows.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.date).toLocaleString("en-PH")}</td>
                          <td>{row.type}</td>
                          <td>
                            <span
                              className={
                                row.quantityChange >= 0
                                  ? "inventory-history-delta inventory-history-delta-positive"
                                  : "inventory-history-delta inventory-history-delta-negative"
                              }
                            >
                              {row.quantityChange >= 0 ? "+" : ""}
                              {formatNumber(row.quantityChange)}
                            </span>
                          </td>
                          <td>{row.reference}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="muted">
                          No transaction history for this item yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="row inventory-modal-footer">
              <SecondaryButton
                onClick={() => {
                  setHistoryOpen(false);
                  setHistoryRows([]);
                  setActiveProduct(null);
                }}
              >
                Close
              </SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal inventory-import-modal inventory-modal-responsive">
            <div className="inventory-modal-header">
              <h3 className="section-title">Import Inventory</h3>
            </div>
            <div className="inventory-modal-body">
              <div className="stack">
                <div className="inventory-import-toolbar">
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={onImportFileSelected}
                    className="inventory-upload-input"
                  />
                  <SecondaryButton type="button" onClick={triggerImportPicker}>
                    Upload File
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={downloadImportTemplate}>
                    Download Template
                  </SecondaryButton>
                </div>

                <div className="field-help">
                  Supported columns: SKU, Product Name, Category, Description, Unit Cost, Price,
                  Current Stock, Compatible Units, Active Status.
                </div>

                {importFileName ? (
                  <div className="inventory-import-file">Selected file: {importFileName}</div>
                ) : null}

                {importingPreview ? (
                  <div className="muted">Reading file and validating rows...</div>
                ) : null}

                {importSummary ? (
                  <div className="inventory-import-summary">
                    <span>Total Rows: {importSummary.totalRows}</span>
                    <span>Successful Rows: {importSummary.successfulRows}</span>
                    <span>Failed Rows: {importSummary.failedRows}</span>
                  </div>
                ) : null}

                {importPreviewRows.length ? (
                  <div className="table-wrap inventory-import-preview">
                    <table>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>SKU</th>
                          <th>Product Name</th>
                          <th>Category</th>
                          <th>Unit Cost</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Status</th>
                          <th>Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.map((row) => (
                          <tr key={`${row.rowNumber}-${row.sku}-${row.name}`}>
                            <td>{row.rowNumber}</td>
                            <td>{row.sku || "-"}</td>
                            <td>{row.name || "-"}</td>
                            <td>{row.category || "-"}</td>
                            <td>{row.unitCost == null ? "-" : formatCurrency(row.unitCost)}</td>
                            <td>{row.price == null ? "-" : formatCurrency(row.price)}</td>
                            <td>{row.stockQty == null ? "-" : formatNumber(row.stockQty)}</td>
                            <td>{row.isActive ? "Active" : "Inactive"}</td>
                            <td>
                              {row.errors.length ? (
                                <div className="inventory-import-errors">
                                  {row.errors.map((error) => (
                                    <span key={error} className="inventory-import-error-chip">
                                      {error}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="inventory-import-ok">Ready</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="row inventory-modal-footer">
              <SecondaryButton type="button" onClick={closeImport}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={importInventoryRows}
                disabled={!importSummary || importSummary.successfulRows === 0 || importingRows}
              >
                {importingRows ? "Importing..." : "Import Rows"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal inventory-modal-responsive inventory-modal-create">
            <div className="inventory-modal-header">
              <h3 className="section-title">Add Item</h3>
            </div>
            <div className="inventory-modal-body">
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
                  placeholder={productSettings.autoGenerateSKU ? "Generated from category" : "Enter SKU"}
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  readOnly={productSettings.autoGenerateSKU}
                />
                {productSettings.autoGenerateSKU ? (
                  <div className="field-help">
                    SKU will be generated automatically based on category.
                  </div>
                ) : null}
                {skuPreviewError ? <div className="login-error">{skuPreviewError}</div> : null}
              </div>
              <div className="form-field">
                <label className="field-label">Description</label>
                <textarea
                  placeholder="Enter description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">UOM</label>
                <select
                  value={form.uomId}
                  onChange={(event) => setForm({ ...form, uomId: event.target.value })}
                >
                  <option value="">Select UOM</option>
                  {availableUoms
                    .filter((uom) => uom.isActive)
                    .map((uom) => (
                      <option key={uom.id} value={uom.id}>
                        {uom.code} - {uom.name}
                      </option>
                    ))}
                </select>
              </div>
              {productSettings.enableProductCategories ? (
                <div className="form-field">
                  <label className="field-label">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(event) => {
                      const nextCategory = availableCategories.find(
                        (category) => category.id === event.target.value
                      );
                      setForm({
                        ...form,
                        categoryId: event.target.value,
                        category: nextCategory?.name ?? "General"
                      });
                    }}
                  >
                    <option value="">Select category</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="row">
                <div className="form-field">
                  <label className="field-label">Unit Cost</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter unit cost"
                    value={createUnitCostInput}
                    onChange={(event) => {
                      const next = sanitizeDecimalInput(event.target.value);
                      setCreateUnitCostInput(next);
                    }}
                    onBlur={() => {
                      if (!createUnitCostInput.trim()) return;
                      const normalized = normalizeDecimalInput(createUnitCostInput);
                      setCreateUnitCostInput(normalized);
                    }}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Initial Quantity</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter quantity"
                    value={createQtyInput}
                    onChange={(event) => {
                      const next = sanitizeIntegerInput(event.target.value);
                      setCreateQtyInput(next);
                    }}
                    onBlur={() => {
                      if (!createQtyInput.trim()) return;
                      const normalized = normalizeIntegerInput(createQtyInput);
                      setCreateQtyInput(normalized);
                    }}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter price"
                    value={createPriceInput}
                    onChange={(event) => {
                      const next = sanitizeDecimalInput(event.target.value);
                      setCreatePriceInput(next);
                    }}
                    onBlur={() => {
                      if (!createPriceInput.trim()) return;
                      const normalized = normalizeDecimalInput(createPriceInput);
                      setCreatePriceInput(normalized);
                    }}
                  />
                </div>
              </div>
              {productSettings.enableCompatibleUnits ? (
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
              ) : null}
              {productSettings.allowProductPhotoUpload ? (
                <div className="form-field">
                  <label className="field-label">Product Photo (Optional)</label>
                  <input
                    ref={createPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onCreatePhotoSelected}
                    className="inventory-upload-input"
                  />
                  {createPhotoPreview ? (
                    <div className="inventory-upload-preview-block">
                      <Image
                        src={createPhotoPreview}
                        alt="New item preview"
                        width={640}
                        height={240}
                        className="inventory-photo-preview"
                      />
                      <div className="inventory-upload-actions">
                        <SecondaryButton type="button" onClick={triggerCreatePhotoPicker}>
                          Change
                        </SecondaryButton>
                        <SecondaryButton type="button" onClick={clearCreatePhoto}>
                          Remove
                        </SecondaryButton>
                      </div>
                    </div>
                  ) : (
                    <div className="inventory-upload-preview-block">
                      <button
                        type="button"
                        className="inventory-upload-box"
                        onClick={triggerCreatePhotoPicker}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleCreatePhotoDrop}
                      >
                        <span className="inventory-upload-title">Click to upload or drag image</span>
                        <span className="inventory-upload-caption">PNG, JPG, WEBP up to 5MB</span>
                      </button>
                      <div className="inventory-upload-actions inventory-upload-actions-start">
                        <PrimaryButton type="button" onClick={triggerCreatePhotoPicker}>
                          Upload Photo
                        </PrimaryButton>
                        <SecondaryButton
                          type="button"
                          onClick={openCameraModal}
                          disabled={!cameraSupported}
                          title={
                            cameraSupported
                              ? "Capture photo from camera"
                              : "Camera is not supported on this device"
                          }
                        >
                          Take Photo
                        </SecondaryButton>
                      </div>
                      {!cameraSupported ? (
                        <div className="field-help">Camera capture is not available on this browser or device.</div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            </div>
            <div className="row inventory-modal-footer">
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
                <div className="inventory-form-section">
                  <div className="inventory-form-section-title">Product Info</div>
                  <div className="inventory-form-grid">
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
                      <input value={form.sku} disabled />
                      <div className="field-help">SKU is locked for existing products.</div>
                    </div>
                    {productSettings.enableProductCategories ? (
                      <div className="form-field inventory-form-grid-span-2">
                        <label className="field-label">Category</label>
                        <select
                          value={form.categoryId}
                          onChange={(event) => {
                            const nextCategory = availableCategories.find(
                              (category) => category.id === event.target.value
                            );
                            setForm({
                              ...form,
                              categoryId: event.target.value,
                              category: nextCategory?.name ?? form.category
                            });
                          }}
                        >
                          <option value="">Select category</option>
                          {availableCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name} ({category.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="inventory-form-section">
                  <div className="inventory-form-section-title">Details</div>
                  <div className="stack">
                    <div className="form-field">
                      <label className="field-label">Description</label>
                      <textarea
                        placeholder="Description"
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">UOM</label>
                      <select
                        value={form.uomId}
                        onChange={(event) => setForm({ ...form, uomId: event.target.value })}
                      >
                        <option value="">Select UOM</option>
                        {availableUoms
                          .filter((uom) => uom.isActive || uom.id === form.uomId)
                          .map((uom) => (
                            <option key={uom.id} value={uom.id}>
                              {uom.code} - {uom.name}
                              {!uom.isActive ? " (Inactive)" : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    {productSettings.enableCompatibleUnits ? (
                      <div className="form-field">
                        <label className="field-label">Compatible Units</label>
                        <textarea
                          placeholder="Compatible Units"
                          value={form.compatibleUnits ?? ""}
                          onChange={(event) => setForm({ ...form, compatibleUnits: event.target.value })}
                        />
                        <div className="field-help">
                          For cashier reference only. Does not affect pricing or stock.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="inventory-form-section">
                  <div className="inventory-form-grid">
                    <div className="form-field">
                      <label className="field-label">Unit Cost</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter unit cost"
                        value={editUnitCostInput}
                        onChange={(event) => setEditUnitCostInput(sanitizeDecimalInput(event.target.value))}
                        onBlur={() => {
                          if (!editUnitCostInput.trim()) return;
                          setEditUnitCostInput(normalizeDecimalInput(editUnitCostInput));
                        }}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Price</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter price"
                        value={editPriceInput}
                        onChange={(event) => setEditPriceInput(sanitizeDecimalInput(event.target.value))}
                        onBlur={() => {
                          if (!editPriceInput.trim()) return;
                          setEditPriceInput(normalizeDecimalInput(editPriceInput));
                        }}
                      />
                    </div>
                    <div className="form-field inventory-status-field">
                      <label className="field-label">Status</label>
                      <label className="configuration-check">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                        />
                        Active
                      </label>
                    </div>
                  </div>
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
              <PrimaryButton onClick={updateProduct}>Update Item</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal inventory-camera-modal">
            <h3 className="section-title">Take Photo</h3>
            <div className="stack">
              <div className="inventory-camera-frame">
                {cameraCapturedPreview ? (
                  <Image
                    src={cameraCapturedPreview}
                    alt="Captured product preview"
                    width={640}
                    height={360}
                    className="inventory-photo-preview inventory-camera-preview"
                  />
                ) : (
                  <video ref={cameraVideoRef} className="inventory-camera-video" playsInline muted />
                )}
                <canvas ref={cameraCanvasRef} className="inventory-camera-canvas" />
              </div>
              {cameraError ? <div className="login-error">{cameraError}</div> : null}
              <div className="inventory-upload-actions inventory-camera-actions">
                {cameraCapturedPreview ? (
                  <>
                    <SecondaryButton type="button" onClick={retakeCameraPhoto}>
                      Retake
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={useCapturedPhoto}>
                      Use Photo
                    </PrimaryButton>
                  </>
                ) : (
                  <PrimaryButton type="button" onClick={captureCameraPhoto}>
                    Capture
                  </PrimaryButton>
                )}
                <SecondaryButton type="button" onClick={closeCameraModal}>
                  Cancel
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {adjustOpen && activeProduct ? (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal inventory-adjust-modal">
            <h3 className="section-title">Adjust Stock</h3>
            <div className="stack">
              <div className="muted">Product: {activeProduct.name}</div>
              <label className="form-field">
                <span className="field-label">Adjustment Quantity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Use negative for stock-out, positive for stock-in"
                  value={adjustQtyInput}
                  onChange={(event) => setAdjustQtyInput(sanitizeSignedAdjustmentInput(event.target.value))}
                />
              </label>
              <div className="field-help">
                Positive values add stock. Negative values deduct stock.
              </div>
              {projectedStock !== null ? (
                <div className="field-help">
                  New stock: <strong>{formatNumber(projectedStock)}</strong>
                </div>
              ) : null}
              <label className="form-field">
                <span className="field-label">Reason</span>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="Enter adjustment reason"
                />
              </label>
              {!productSettings.allowNegativeStock ? (
                <div className="field-help">
                  Negative stock is disabled. Adjustments that reduce stock below zero will be blocked.
                </div>
              ) : null}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <SecondaryButton
                onClick={() => {
                  setAdjustOpen(false);
                  setActiveProduct(null);
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={saveAdjustment} disabled={adjustSaving}>
                {adjustSaving ? "Saving..." : "Save Adjustment"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
