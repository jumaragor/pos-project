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
  showCustomerName: boolean;
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

function cleanText(value: string | undefined | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

export function buildReceiptData(source: ReceiptSource, settings: ReceiptSettings): ReceiptData {
  const businessName = cleanText(settings.businessName) ?? cleanText(settings.storeName) ?? "MicroBiz POS";
  const storeName = cleanText(settings.storeName);
  const tradeName = storeName && storeName !== businessName ? storeName : undefined;
  const totalReceived = Number(source.cashAmount ?? 0) + Number(source.qrAmount ?? 0);
  const changeAmount = totalReceived > 0 ? Math.max(totalReceived - Number(source.total), 0) : undefined;
  const taxAmount = settings.enableTax ? Number(source.taxAmount ?? 0) : 0;
  const taxLabel = cleanText(settings.taxLabel) ?? "VAT";

  return {
    businessName,
    tradeName,
    branchName: tradeName,
    address: cleanText(settings.storeAddress),
    contactNumber: cleanText(settings.storeContactNumber),
    email: cleanText(settings.storeEmailAddress),
    tin: cleanText(settings.tin),
    permitNo: cleanText(settings.permitNo),
    logoUrl: cleanText(settings.storeLogoUrl),
    transactionNumber: cleanText(source.txNumber),
    createdAt: source.createdAt,
    cashierName: settings.showCashierName ? cleanText(source.cashierName) : undefined,
    customerName: settings.showCustomerName ? cleanText(source.customerName) : undefined,
    paymentMethod: source.paymentMethod,
    subtotal: Number(source.subtotal),
    discount: Number(source.discountTotal ?? source.discount ?? 0),
    taxLabel: taxAmount > 0 ? taxLabel : undefined,
    taxRate: taxAmount > 0 ? Number(settings.defaultTaxRate ?? 0) : undefined,
    taxAmount: taxAmount > 0 ? taxAmount : undefined,
    total: Number(source.total),
    cashReceived: source.cashAmount == null ? undefined : Number(source.cashAmount),
    qrReceived: source.qrAmount == null ? undefined : Number(source.qrAmount),
    changeAmount: settings.showChangeAmount ? changeAmount : undefined,
    footerMessage: cleanText(settings.receiptFooterMessage),
    items: source.items.map((item) => ({
      ...item,
      qty: Number(item.qty),
      lineTotal: Number(item.lineTotal),
      unitPrice:
        item.unitPrice != null
          ? Number(item.unitPrice)
          : Number(item.qty) > 0
            ? Number(item.lineTotal) / Number(item.qty)
            : 0
    }))
  };
}
