import { CategoryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ProductSettings } from "@/lib/product-settings";

export const inventoryImportColumns = [
  "SKU",
  "Product Name",
  "Category",
  "Description",
  "Price",
  "Current Stock",
  "Compatible Units",
  "Active Status"
] as const;

export type InventoryImportPreviewRow = {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number | null;
  stockQty: number | null;
  compatibleUnits: string;
  isActive: boolean;
  errors: string[];
};

export type InventoryImportValidatedRow = InventoryImportPreviewRow & {
  price: number;
  stockQty: number;
  categoryId: string | null;
  categoryName: string;
};

type RawRow = Record<string, unknown>;

function normalizeHeaderKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCell(row: RawRow, candidates: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeaderKey(key), value])
  );
  for (const candidate of candidates) {
    const found = normalized.get(normalizeHeaderKey(candidate));
    if (found != null) {
      return found;
    }
  }
  return undefined;
}

function toText(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function toNumber(value: unknown) {
  if (value == null || value === "") return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanStatus(value: unknown) {
  const text = toText(value).toLowerCase();
  if (!text) return true;
  if (["active", "true", "yes", "1"].includes(text)) return true;
  if (["inactive", "false", "no", "0", "archived"].includes(text)) return false;
  return null;
}

export async function validateInventoryImportRows(
  rows: RawRow[],
  settings: ProductSettings
): Promise<{
  previewRows: InventoryImportPreviewRow[];
  validRows: InventoryImportValidatedRow[];
}> {
  const categories = settings.enableProductCategories
    ? await prisma.category.findMany({
        where: { status: CategoryStatus.ACTIVE },
        select: { id: true, name: true, code: true }
      })
    : [];

  const categoryByLookup = new Map<string, { id: string; name: string }>();
  for (const category of categories) {
    categoryByLookup.set(category.name.trim().toLowerCase(), { id: category.id, name: category.name });
    categoryByLookup.set(category.code.trim().toLowerCase(), { id: category.id, name: category.name });
  }

  const parsedRows = rows.map((row, index) => {
    const sku = toText(getCell(row, ["SKU"])).toUpperCase();
    const name = toText(getCell(row, ["Product Name", "Name"]));
    const categoryInput = toText(getCell(row, ["Category", "Category Code"]));
    const description = toText(getCell(row, ["Description"]));
    const price = toNumber(getCell(row, ["Price", "Selling Price"]));
    const stockQty = toNumber(getCell(row, ["Current Stock", "Stock", "Initial Stock"]));
    const compatibleUnits = toText(getCell(row, ["Compatible Units"]));
    const statusInput = getCell(row, ["Active Status", "Status"]);
    const isActive = toBooleanStatus(statusInput);
    const errors: string[] = [];

    if (!sku) errors.push("SKU is required");
    if (!name) errors.push("Product Name is required");
    if (price == null) errors.push("Price must be a valid number");
    if (stockQty == null) errors.push("Current Stock must be a valid number");
    if (stockQty != null && stockQty < 0) errors.push("Current Stock cannot be negative");
    if (price != null && price < 0) errors.push("Price cannot be negative");
    if (settings.enableProductCategories && !categoryInput) {
      errors.push("Category is required");
    }
    if (statusInput != null && toText(statusInput) && isActive == null) {
      errors.push("Active Status must be Active or Inactive");
    }

    const matchedCategory =
      settings.enableProductCategories && categoryInput
        ? categoryByLookup.get(categoryInput.trim().toLowerCase()) ?? null
        : null;
    if (settings.enableProductCategories && categoryInput && !matchedCategory) {
      errors.push("Category was not found or is inactive");
    }

    return {
      rowNumber: index + 2,
      sku,
      name,
      category: matchedCategory?.name ?? categoryInput,
      description,
      price,
      stockQty,
      compatibleUnits,
      isActive: isActive ?? true,
      categoryId: matchedCategory?.id ?? null,
      errors
    };
  });

  const fileDuplicates = new Map<string, number[]>();
  for (const row of parsedRows) {
    if (!row.sku) continue;
    const duplicates = fileDuplicates.get(row.sku) ?? [];
    duplicates.push(row.rowNumber);
    fileDuplicates.set(row.sku, duplicates);
  }
  for (const row of parsedRows) {
    const duplicates = row.sku ? fileDuplicates.get(row.sku) ?? [] : [];
    if (duplicates.length > 1) {
      row.errors.push(`Duplicate SKU in file (${duplicates.join(", ")})`);
    }
  }

  const candidateSkus = parsedRows.map((row) => row.sku).filter(Boolean);
  if (candidateSkus.length) {
    const existing = await prisma.product.findMany({
      where: { sku: { in: candidateSkus } },
      select: { sku: true }
    });
    const existingSet = new Set(existing.map((item) => item.sku));
    for (const row of parsedRows) {
      if (row.sku && existingSet.has(row.sku)) {
        row.errors.push("SKU already exists");
      }
    }
  }

  const previewRows: InventoryImportPreviewRow[] = parsedRows.map((row) => ({
    rowNumber: row.rowNumber,
    sku: row.sku,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    stockQty: row.stockQty,
    compatibleUnits: row.compatibleUnits,
    isActive: row.isActive,
    errors: row.errors
  }));

  const validRows: InventoryImportValidatedRow[] = parsedRows
    .filter((row) => row.errors.length === 0)
    .map((row) => ({
      rowNumber: row.rowNumber,
      sku: row.sku,
      name: row.name,
      category: row.category,
      categoryId: row.categoryId,
      categoryName: row.category || "General",
      description: row.description,
      price: row.price ?? 0,
      stockQty: row.stockQty ?? 0,
      compatibleUnits: row.compatibleUnits,
      isActive: row.isActive,
      errors: []
    }));

  return { previewRows, validRows };
}

export function toInventoryExportRows(
  products: Array<{
    sku: string;
    name: string;
    category: string;
    description: string | null;
    sellingPrice: Prisma.Decimal | number;
    stockQty: Prisma.Decimal | number;
    compatibleUnits: string | null;
    isActive: boolean;
  }>
) {
  return products.map((product) => ({
    SKU: product.sku,
    "Product Name": product.name,
    Category: product.category,
    Description: product.description ?? "",
    Price: Number(product.sellingPrice),
    "Current Stock": Number(product.stockQty),
    "Compatible Units": product.compatibleUnits ?? "",
    "Active Status": product.isActive ? "Active" : "Inactive"
  }));
}

