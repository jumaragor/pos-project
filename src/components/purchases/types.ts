import type { PurchaseStatus, SupplierStatus } from "@prisma/client";

export type PurchaseItemRow = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
};

export type PurchaseSummaryRow = {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string | null;
  supplierName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  totalItems: number;
  totalCost: number;
  status: PurchaseStatus;
};

export type PurchaseDetailRow = PurchaseSummaryRow & {
  items: PurchaseItemRow[];
};

export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SupplierOption = {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactPerson?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  status: SupplierStatus;
};

export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  description: string;
  unit: string;
  unitCost: number;
};
