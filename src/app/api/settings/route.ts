import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { invalidateInventorySettingsCache } from "@/lib/inventory-settings";
import { invalidateProductSettingsCache } from "@/lib/product-settings";

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
  showCashierName: "true",
  showCustomerName: "true",
  showChangeAmount: "true",
  defaultPaymentMethod: "CASH",
  requireCustomerBeforeSale: "false",
  storeName: "MicroBiz POS",
  businessName: "",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "Thank you for shopping!",
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
  themePreset: "DEFAULT_NAVY",
  themePrimaryColor: "#0F172A",
  themeAccentColor: "#2563EB",
  themeSidebarActiveColor: "#1E3A8A",
  themeDangerColor: "#DC2626"
};

function coerceValue(raw: string) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return raw;
}

export async function GET() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: Object.keys(defaultSettings) } }
  });
  const valueByKey = new Map(settings.map((setting) => [setting.key, setting.value]));
  const payload = Object.fromEntries(
    Object.entries(defaultSettings).map(([key, fallback]) => [key, coerceValue(valueByKey.get(key) ?? fallback)])
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
        update: { value: String(value ?? "") },
        create: { key, value: String(value ?? "") }
      })
    )
  );
  invalidateInventorySettingsCache();
  invalidateProductSettingsCache();
  const refreshed = await prisma.appSetting.findMany({
    where: { key: { in: Object.keys(defaultSettings) } }
  });
  const valueByKey = new Map(refreshed.map((setting) => [setting.key, setting.value]));
  const payload = Object.fromEntries(
    Object.entries(defaultSettings).map(([key, fallback]) => [key, coerceValue(valueByKey.get(key) ?? fallback)])
  );
  return ok(payload);
}
