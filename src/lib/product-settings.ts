import { prisma } from "@/lib/prisma";

export type ProductSettings = {
  enableProductCategories: boolean;
  enableCompatibleUnits: boolean;
  allowProductPhotoUpload: boolean;
  requireSKU: boolean;
  autoGenerateSKU: boolean;
  skuGenerationMode: "MANUAL" | "GLOBAL" | "CATEGORY_BASED";
};

export const defaultProductSettings: ProductSettings = {
  enableProductCategories: true,
  enableCompatibleUnits: true,
  allowProductPhotoUpload: true,
  requireSKU: true,
  autoGenerateSKU: false,
  skuGenerationMode: "GLOBAL"
};
const SETTINGS_TTL_MS = 30_000;
let productSettingsCache:
  | {
      value: ProductSettings;
      expiresAt: number;
    }
  | null = null;

function isTruthySetting(value: string | null | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;
  return value === "true";
}

function asSkuMode(value: string | null | undefined, fallback: ProductSettings["skuGenerationMode"]) {
  if (value === "MANUAL" || value === "GLOBAL" || value === "CATEGORY_BASED") {
    return value;
  }
  return fallback;
}

export async function getProductSettings(): Promise<ProductSettings> {
  if (productSettingsCache && productSettingsCache.expiresAt > Date.now()) {
    return productSettingsCache.value;
  }
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "enableProductCategories",
          "enableCompatibleUnits",
          "allowProductPhotoUpload",
          "requireSKU",
          "autoGenerateSKU",
          "skuGenerationMode"
        ]
      }
    }
  });

  const valueByKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  const value = {
    enableProductCategories: isTruthySetting(
      valueByKey.get("enableProductCategories"),
      defaultProductSettings.enableProductCategories
    ),
    enableCompatibleUnits: isTruthySetting(
      valueByKey.get("enableCompatibleUnits"),
      defaultProductSettings.enableCompatibleUnits
    ),
    allowProductPhotoUpload: isTruthySetting(
      valueByKey.get("allowProductPhotoUpload"),
      defaultProductSettings.allowProductPhotoUpload
    ),
    requireSKU: isTruthySetting(valueByKey.get("requireSKU"), defaultProductSettings.requireSKU),
    autoGenerateSKU: isTruthySetting(
      valueByKey.get("autoGenerateSKU"),
      defaultProductSettings.autoGenerateSKU
    ),
    skuGenerationMode: asSkuMode(
      valueByKey.get("skuGenerationMode"),
      defaultProductSettings.skuGenerationMode
    )
  };
  productSettingsCache = {
    value,
    expiresAt: Date.now() + SETTINGS_TTL_MS
  };
  return value;
}

export function invalidateProductSettingsCache() {
  productSettingsCache = null;
}

export async function generateUniqueSku(prefix = "PRD") {
  let counter = (await prisma.product.count()) + 1;

  while (true) {
    const sku = `${prefix}-${String(counter).padStart(4, "0")}`;
    const existing = await prisma.product.findUnique({
      where: { sku },
      select: { id: true }
    });
    if (!existing) {
      return sku;
    }
    counter += 1;
  }
}

export async function generateProductSku(categoryId?: string | null) {
  const settings = await getProductSettings();
  if (!settings.autoGenerateSKU || settings.skuGenerationMode === "MANUAL") {
    return "";
  }
  if (settings.skuGenerationMode === "CATEGORY_BASED" && categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { skuPrefix: true }
    });
    if (category?.skuPrefix) {
      return generateUniqueSku(category.skuPrefix);
    }
  }
  return generateUniqueSku();
}
