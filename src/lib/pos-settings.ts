import { prisma } from "@/lib/prisma";
import type { ReceiptSettings } from "@/lib/receipt";
import type { PrintMode } from "@/lib/print-service";

type PosSettingsSnapshot = {
  enableProductCategories: boolean;
  enableCompatibleUnits: boolean;
  allowProductPhotoUpload: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  allowDiscountEntry: boolean;
  autoPrintReceipt: boolean;
  printMode: PrintMode;
  androidBridgeUrl: string;
  androidBridgeToken: string;
  enableBrowserPrintFallback: boolean;
  productDisplayMode: "tile" | "line";
  posProductsPerPage: number;
  receiptSettings: ReceiptSettings;
};

const defaultSettings = {
  enableProductCategories: true,
  enableCompatibleUnits: true,
  allowProductPhotoUpload: true,
  enableLowStockAlerts: true,
  lowStockThreshold: 10,
  allowDiscountEntry: true,
  autoPrintReceipt: false,
  printMode: (process.env.NEXT_PUBLIC_PRINT_BRIDGE_TOKEN ? "windows-bridge" : "browser") as PrintMode,
  androidBridgeUrl: "http://127.0.0.1:17890",
  androidBridgeToken: "",
  enableBrowserPrintFallback: true,
  productDisplayMode: "tile" as const,
  posProductsPerPage: 50,
  businessName: "",
  storeName: "MicroBiz POS",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "",
  tin: "",
  permitNo: "",
  showCashierName: true,
  showChangeAmount: true,
  enableTax: true,
  defaultTaxRate: 12,
  taxLabel: "VAT",
  taxInclusivePricing: false
};

let posSettingsCache: PosSettingsSnapshot | null = null;
let posSettingsPromise: Promise<PosSettingsSnapshot> | null = null;

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toNumberValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getPosSettings() {
  if (posSettingsCache) return posSettingsCache;
  if (posSettingsPromise) return posSettingsPromise;

  posSettingsPromise = prisma.appSetting
    .findMany({
      where: {
        key: {
          in: [
            "enableProductCategories",
            "enableCompatibleUnits",
            "allowProductPhotoUpload",
            "enableLowStockAlerts",
            "lowStockThreshold",
            "allowDiscountEntry",
            "autoPrintReceipt",
            "printMode",
            "androidBridgeUrl",
            "androidBridgeToken",
            "enableBrowserPrintFallback",
            "productDisplayMode",
            "posProductsPerPage",
            "businessName",
            "storeName",
            "storeAddress",
            "storeContactNumber",
            "storeEmailAddress",
            "storeLogoUrl",
            "receiptFooterMessage",
            "tin",
            "permitNo",
            "showCashierName",
            "showChangeAmount",
            "enableTax",
            "defaultTaxRate",
            "taxLabel",
            "taxInclusivePricing"
          ]
        }
      }
    })
    .then((settings) => {
      const valueByKey = new Map(settings.map((setting) => [setting.key, setting.value]));
      const snapshot: PosSettingsSnapshot = {
        enableProductCategories: toBoolean(
          valueByKey.get("enableProductCategories"),
          defaultSettings.enableProductCategories
        ),
        enableCompatibleUnits: toBoolean(
          valueByKey.get("enableCompatibleUnits"),
          defaultSettings.enableCompatibleUnits
        ),
        allowProductPhotoUpload: toBoolean(
          valueByKey.get("allowProductPhotoUpload"),
          defaultSettings.allowProductPhotoUpload
        ),
        enableLowStockAlerts: toBoolean(
          valueByKey.get("enableLowStockAlerts"),
          defaultSettings.enableLowStockAlerts
        ),
        lowStockThreshold: toNumberValue(
          valueByKey.get("lowStockThreshold"),
          defaultSettings.lowStockThreshold
        ),
        allowDiscountEntry: toBoolean(
          valueByKey.get("allowDiscountEntry"),
          defaultSettings.allowDiscountEntry
        ),
        autoPrintReceipt: toBoolean(
          valueByKey.get("autoPrintReceipt"),
          defaultSettings.autoPrintReceipt
        ),
        printMode: (["browser", "windows-bridge", "android-escpos-bridge"].includes(
          valueByKey.get("printMode") ?? ""
        )
          ? valueByKey.get("printMode")
          : defaultSettings.printMode) as PrintMode,
        androidBridgeUrl: valueByKey.get("androidBridgeUrl") ?? defaultSettings.androidBridgeUrl,
        androidBridgeToken:
          valueByKey.get("androidBridgeToken") ?? defaultSettings.androidBridgeToken,
        enableBrowserPrintFallback: toBoolean(
          valueByKey.get("enableBrowserPrintFallback"),
          defaultSettings.enableBrowserPrintFallback
        ),
        productDisplayMode:
          valueByKey.get("productDisplayMode") === "line"
            ? "line"
            : defaultSettings.productDisplayMode,
        posProductsPerPage: Math.max(
          1,
          toNumberValue(valueByKey.get("posProductsPerPage"), defaultSettings.posProductsPerPage)
        ),
        receiptSettings: {
          businessName: valueByKey.get("businessName") ?? defaultSettings.businessName,
          storeName: valueByKey.get("storeName") ?? defaultSettings.storeName,
          storeAddress: valueByKey.get("storeAddress") ?? defaultSettings.storeAddress,
          storeContactNumber:
            valueByKey.get("storeContactNumber") ?? defaultSettings.storeContactNumber,
          storeEmailAddress:
            valueByKey.get("storeEmailAddress") ?? defaultSettings.storeEmailAddress,
          storeLogoUrl: valueByKey.get("storeLogoUrl") ?? defaultSettings.storeLogoUrl,
          receiptFooterMessage:
            valueByKey.get("receiptFooterMessage") ?? defaultSettings.receiptFooterMessage,
          tin: valueByKey.get("tin") ?? defaultSettings.tin,
          permitNo: valueByKey.get("permitNo") ?? defaultSettings.permitNo,
          showCashierName: toBoolean(
            valueByKey.get("showCashierName"),
            defaultSettings.showCashierName
          ),
          showChangeAmount: toBoolean(
            valueByKey.get("showChangeAmount"),
            defaultSettings.showChangeAmount
          ),
          enableTax: toBoolean(valueByKey.get("enableTax"), defaultSettings.enableTax),
          defaultTaxRate: toNumberValue(
            valueByKey.get("defaultTaxRate"),
            defaultSettings.defaultTaxRate
          ),
          taxLabel: valueByKey.get("taxLabel") ?? defaultSettings.taxLabel,
          taxInclusivePricing: toBoolean(
            valueByKey.get("taxInclusivePricing"),
            defaultSettings.taxInclusivePricing
          )
        }
      };
      posSettingsCache = snapshot;
      posSettingsPromise = null;
      return snapshot;
    })
    .catch((error) => {
      posSettingsPromise = null;
      throw error;
    });

  return posSettingsPromise;
}

export function invalidatePosSettingsCache() {
  posSettingsCache = null;
  posSettingsPromise = null;
}
