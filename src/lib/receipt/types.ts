import { PaymentMethod } from "@prisma/client";

export type ReceiptSettings = {
  businessName: string;
  storeName: string;
  storeAddress: string;
  storeContactNumber: string;
  storeEmailAddress: string;
  storeLogoUrl: string;
  receiptFooterMessage: string;
  tin: string;
  permitNo: string;
  showCashierName: boolean;
  showChangeAmount: boolean;
  enableTax: boolean;
  defaultTaxRate: number;
  taxLabel: string;
  taxInclusivePricing: boolean;
};

export type ReceiptSourceItem = {
  name: string;
  qty: number;
  unitPrice?: number;
  lineTotal: number;
};

export type ReceiptSource = {
  txNumber?: string;
  synced: boolean;
  createdAt: string;
  customerName?: string;
  cashierName?: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  qrAmount?: number;
  subtotal: number;
  discount: number;
  discountTotal?: number;
  taxAmount?: number;
  total: number;
  items: ReceiptSourceItem[];
};

export type ReceiptData = {
  businessName: string;
  tradeName?: string;
  branchName?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  tin?: string;
  permitNo?: string;
  logoUrl?: string;
  transactionNumber?: string;
  createdAt: string;
  cashierName?: string;
  customerName?: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  taxLabel?: string;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  cashReceived?: number;
  qrReceived?: number;
  changeAmount?: number;
  footerMessage?: string;
  items: Array<ReceiptSourceItem & { unitPrice: number }>;
};
