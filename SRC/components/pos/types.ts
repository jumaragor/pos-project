import { PaymentMethod } from "@prisma/client";

export type ProductLite = {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  barcode?: string | null;
  photoUrl?: string | null;
  sellingPrice: number;
  stockQty: number;
  lowStockThreshold?: number;
};

export type CustomerLite = {
  id: string;
  name: string;
};

export type CartLine = {
  productId: string;
  name: string;
  qty: number;
  price: number;
};

export type HoldOrder = {
  id: string;
  label: string;
  createdAt: string;
  cart: CartLine[];
  customerId: string;
  orderDiscountType: "PERCENT" | "FIXED";
  orderDiscountValue: number;
  paymentMethod: PaymentMethod;
};
