"use client";

import Dexie, { Table } from "dexie";

export type PendingOp = {
  id?: number;
  opId: string;
  type: "SALE" | "ADJUSTMENT" | "REPACK";
  payload: Record<string, unknown>;
  status: "pending" | "error";
  retries: number;
  createdAt: string;
  error?: string;
};

export type CachedProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: number;
  stockQty: number;
  updatedAt: string;
};

class MicroBizDB extends Dexie {
  pendingOps!: Table<PendingOp, number>;
  cachedProducts!: Table<CachedProduct, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("microbiz");
    this.version(1).stores({
      pendingOps: "++id, opId, status, createdAt",
      cachedProducts: "id, sku, barcode, updatedAt",
      meta: "key"
    });
  }
}

export const db = new MicroBizDB();
