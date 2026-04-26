import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { invalidateInventorySettingsCache } from "@/lib/inventory-settings";
import { invalidateProductSettingsCache } from "@/lib/product-settings";
import { invalidatePosSettingsCache } from "@/lib/pos-settings";

type LoginCarouselImageSetting = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
};

const defaultPrintMode = process.env.NEXT_PUBLIC_PRINT_BRIDGE_TOKEN ? "windows-bridge" : "browser";

const defaultSettings: Record<string, string> = {
  allowNegativeStock: "false",
  lowStockThreshold: "10",
  allowManualStockAdjustments: "true",
  allowProductDeletion: "false",
  enableLowStockAlerts: "true",
  inventoryValuationMethod: "STANDARD",
  enableTax: "true",
  defaultTaxRate: "12",
  taxLabel: "VAT",
  taxInclusivePricing: "false",
  allowManualTaxEntryInPurchases: "true",
  enableBarcodeScanner: "true",
  allowPriceOverride: "false",
  allowDiscountEntry: "true",
  autoPrintReceipt: "false",
  printMode: defaultPrintMode,
  androidBridgeUrl: "http://127.0.0.1:17890",
  androidBridgeToken: "",
  enableBrowserPrintFallback: "true",
  showCashierName: "true",
  showChangeAmount: "true",
  defaultPaymentMethod: "CASH",
  productDisplayMode: "tile",
  posProductsPerPage: "50",
  storeName: "MicroBiz POS",
  businessName: "",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "",
  tin: "",
  permitNo: "",
  enableProductCategories: "true",
  enableCompatibleUnits: "true",
  allowProductPhotoUpload: "true",
  autoGenerateSKU: "false",
  currency: "PHP",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,000.00",
  timezone: "Asia/Manila",
  loginCarouselImages: "[]",
  themePreset: "DEFAULT_NAVY",
  themePrimaryColor: "#0F172A",
  themeAccentColor: "#2563EB",
  themeSidebarActiveColor: "#1E3A8A",
  themeDangerColor: "#DC2626"
};

function sanitizeLoginCarouselImages(raw: unknown): LoginCarouselImageSetting[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url) return null;

      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `login-carousel-${index + 1}`,
        url,
        alt: typeof record.alt === "string" ? record.alt.trim() : "",
        sortOrder: Number.isFinite(Number(record.sortOrder)) ? Number(record.sortOrder) : index,
        isActive: record.isActive !== false
      } satisfies LoginCarouselImageSetting;
    })
    .filter((item): item is LoginCarouselImageSetting => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index
    }));
}

function coerceValue(key: string, raw: string) {
  if (key === "loginCarouselImages") {
    try {
      return sanitizeLoginCarouselImages(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (["printMode", "androidBridgeUrl", "androidBridgeToken"].includes(key)) {
    return raw;
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return raw;
}

function serializeValue(key: string, value: unknown) {
  if (key === "loginCarouselImages") {
    return JSON.stringify(sanitizeLoginCarouselImages(value));
  }
  return String(value ?? "");
}

export async function GET() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: Object.keys(defaultSettings) } }
  });
  const valueByKey = new Map(settings.map((setting) => [setting.key, setting.value]));
  const payload = Object.fromEntries(
    Object.entries(defaultSettings).map(([key, fallback]) => [key, coerceValue(key, valueByKey.get(key) ?? fallback)])
  );
  return ok(payload);
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return forbidden();
  }
  const body = (await request.json()) as Record<string, unknown>;
  const incomingEntries = Object.entries(body).filter(([key]) => key in defaultSettings);
  await prisma.$transaction(
    incomingEntries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: serializeValue(key, value) },
        create: { key, value: serializeValue(key, value) }
      })
    )
  );
  invalidateInventorySettingsCache();
  invalidateProductSettingsCache();
  invalidatePosSettingsCache();
  const refreshed = await prisma.appSetting.findMany({
    where: { key: { in: Object.keys(defaultSettings) } }
  });
  const valueByKey = new Map(refreshed.map((setting) => [setting.key, setting.value]));
  const payload = Object.fromEntries(
    Object.entries(defaultSettings).map(([key, fallback]) => [key, coerceValue(key, valueByKey.get(key) ?? fallback)])
  );
  return ok(payload);
}
