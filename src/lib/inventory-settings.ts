import { prisma } from "@/lib/prisma";

export type InventorySettings = {
  allowNegativeStock: boolean;
  lowStockThreshold: number;
  allowManualStockAdjustments: boolean;
  allowProductDeletion: boolean;
  enableLowStockAlerts: boolean;
  inventoryValuationMethod: "STANDARD" | "FIFO";
};

export const defaultInventorySettings: InventorySettings = {
  allowNegativeStock: false,
  lowStockThreshold: 10,
  allowManualStockAdjustments: true,
  allowProductDeletion: false,
  enableLowStockAlerts: true,
  inventoryValuationMethod: "STANDARD"
};
const SETTINGS_TTL_MS = 30_000;
let inventorySettingsCache:
  | {
      value: InventorySettings;
      expiresAt: number;
    }
  | null = null;

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;
  return value === "true";
}

function parseNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getInventorySettings(): Promise<InventorySettings> {
  if (inventorySettingsCache && inventorySettingsCache.expiresAt > Date.now()) {
    return inventorySettingsCache.value;
  }
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "allowNegativeStock",
          "lowStockThreshold",
          "allowManualStockAdjustments",
          "allowProductDeletion",
          "enableLowStockAlerts",
          "inventoryValuationMethod"
        ]
      }
    }
  });

  const byKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  const value = {
    allowNegativeStock: parseBoolean(
      byKey.get("allowNegativeStock"),
      defaultInventorySettings.allowNegativeStock
    ),
    lowStockThreshold: parseNumber(
      byKey.get("lowStockThreshold"),
      defaultInventorySettings.lowStockThreshold
    ),
    allowManualStockAdjustments: parseBoolean(
      byKey.get("allowManualStockAdjustments"),
      defaultInventorySettings.allowManualStockAdjustments
    ),
    allowProductDeletion: parseBoolean(
      byKey.get("allowProductDeletion"),
      defaultInventorySettings.allowProductDeletion
    ),
    enableLowStockAlerts: parseBoolean(
      byKey.get("enableLowStockAlerts"),
      defaultInventorySettings.enableLowStockAlerts
    ),
    inventoryValuationMethod:
      byKey.get("inventoryValuationMethod") === "FIFO"
        ? "FIFO"
        : defaultInventorySettings.inventoryValuationMethod
  };
  inventorySettingsCache = {
    value,
    expiresAt: Date.now() + SETTINGS_TTL_MS
  };
  return value;
}

export function invalidateInventorySettingsCache() {
  inventorySettingsCache = null;
}
