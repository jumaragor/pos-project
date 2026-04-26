"use client";

import { useEffect, useMemo, useState } from "react";
import { PaymentMethod } from "@prisma/client";
import { useSession } from "next-auth/react";
import { db } from "@/lib/offline-db";
import { applyDiscount } from "@/lib/pricing";
import { PrintMode, printReceipt } from "@/lib/print-service";
import { ReceiptData } from "@/lib/receipt";
import {
  normalizeDecimalInput,
  normalizeIntegerInput,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  toNumber
} from "@/lib/numeric-input";
import { useToast } from "@/components/toast-provider";

type ProductLite = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: number;
  stockQty: number;
};

type CustomerLite = {
  id: string;
  name: string;
};

type CartLine = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  discountType?: "PERCENT" | "FIXED";
  discountValue?: number;
};

type CompletedSale = {
  txNumber?: string;
  synced: boolean;
  createdAt: string;
  customerName?: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  qrAmount?: number;
  subtotal: number;
  discount: number;
  total: number;
  items: Array<{
    name: string;
    qty: number;
    lineTotal: number;
  }>;
};

type LegacyPrintSettings = {
  printMode: PrintMode;
  androidBridgeUrl: string;
  androidBridgeHealthUrl: string;
  androidBridgeToken: string;
  enableBrowserPrintFallback: boolean;
  businessName: string;
  storeName: string;
  storeAddress: string;
  storeContactNumber: string;
  storeEmailAddress: string;
  receiptFooterMessage: string;
};

export function POSScreen({ products, customers }: { products: ProductLite[]; customers: CustomerLite[] }) {
  const { data: session } = useSession();
  const { success, warning, error } = useToast();
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [qrAmount, setQrAmount] = useState<number>(0);
  const [orderDiscountType, setOrderDiscountType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [printSettings, setPrintSettings] = useState<LegacyPrintSettings>({
    printMode: "browser",
    androidBridgeUrl: "http://127.0.0.1:17890",
    androidBridgeHealthUrl: "http://127.0.0.1:17890/health",
    androidBridgeToken: "",
    enableBrowserPrintFallback: true,
    businessName: "MicroBiz POS",
    storeName: "MicroBiz POS",
    storeAddress: "",
    storeContactNumber: "",
    storeEmailAddress: "",
    receiptFooterMessage: "Thank you for your purchase."
  });
  const [recentTransactions, setRecentTransactions] = useState<
    Array<{ id: string; number: string; status: string; totalAmount: string }>
  >([]);

  async function loadTransactions() {
    const response = await fetch("/api/pos/transactions");
    const data = await response.json();
    setRecentTransactions(data);
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPrintSettings() {
      const response = await fetch("/api/settings");
      if (!response.ok) return;
      const payload = await response.json();
      if (!mounted) return;
      setPrintSettings({
        printMode: ["browser", "windows-bridge", "android-escpos-bridge"].includes(String(payload.printMode))
          ? (payload.printMode as PrintMode)
          : "browser",
        androidBridgeUrl: String(payload.androidBridgeUrl ?? "http://127.0.0.1:17890"),
        androidBridgeHealthUrl: String(payload.androidBridgeHealthUrl ?? "http://127.0.0.1:17890/health"),
        androidBridgeToken: String(payload.androidBridgeToken ?? ""),
        enableBrowserPrintFallback: payload.enableBrowserPrintFallback !== false,
        businessName: String(payload.businessName ?? "MicroBiz POS"),
        storeName: String(payload.storeName ?? "MicroBiz POS"),
        storeAddress: String(payload.storeAddress ?? ""),
        storeContactNumber: String(payload.storeContactNumber ?? ""),
        storeEmailAddress: String(payload.storeEmailAddress ?? ""),
        receiptFooterMessage: String(payload.receiptFooterMessage ?? "Thank you for your purchase.")
      });
    }

    void loadPrintSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.sku.toLowerCase().includes(q) ||
          product.barcode?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [products, query]);

  const totals = useMemo(() => {
    const lineNet = cart.reduce((acc, line) => {
      const base = line.qty * line.price;
      const discount = applyDiscount(base, line.discountType ? { type: line.discountType, value: line.discountValue ?? 0 } : undefined);
      return acc + discount.final;
    }, 0);
    const orderDiscount = applyDiscount(lineNet, { type: orderDiscountType, value: orderDiscountValue });
    return { subtotal: lineNet, total: orderDiscount.final, discount: orderDiscount.amount };
  }, [cart, orderDiscountType, orderDiscountValue]);

  function addProduct(product: ProductLite) {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, qty: line.qty + 1 } : line
        );
      }
      return [...prev, { productId: product.id, name: product.name, qty: 1, price: product.sellingPrice }];
    });
  }

  function buildSaleSnapshot(txNumber?: string, synced = true): CompletedSale {
    const gross = cart.reduce((sum, line) => sum + line.qty * line.price, 0);
    const customer = customers.find((row) => row.id === customerId);
    return {
      txNumber,
      synced,
      createdAt: new Date().toISOString(),
      customerName: customer?.name,
      paymentMethod,
      cashAmount: paymentMethod === "CASH" || paymentMethod === "SPLIT" ? cashAmount : undefined,
      qrAmount: paymentMethod === "QR" || paymentMethod === "SPLIT" ? qrAmount : undefined,
      subtotal: gross,
      discount: totals.discount + (gross - totals.subtotal),
      total: totals.total,
      items: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        lineTotal: line.qty * line.price
      }))
    };
  }

  function toReceiptData(sale: CompletedSale): ReceiptData {
    return {
      businessName: printSettings.businessName || printSettings.storeName,
      tradeName: printSettings.storeName,
      address: printSettings.storeAddress,
      contactNumber: printSettings.storeContactNumber,
      email: printSettings.storeEmailAddress,
      transactionNumber: sale.txNumber,
      createdAt: sale.createdAt,
      cashierName: session?.user.name ?? session?.user.username ?? undefined,
      customerName: sale.customerName,
      paymentMethod: sale.paymentMethod,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      cashReceived: sale.cashAmount,
      qrReceived: sale.qrAmount,
      changeAmount: sale.cashAmount != null ? Math.max(sale.cashAmount - sale.total, 0) : undefined,
      footerMessage: printSettings.receiptFooterMessage,
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: item.qty ? item.lineTotal / item.qty : item.lineTotal
      }))
    };
  }

  async function printSaleTransaction(sale = completedSale) {
    if (!sale) return;
    try {
      const result = await printReceipt(toReceiptData(sale), printSettings);
      if (result.mode === "browser-fallback") {
        warning(result.message);
      } else {
        success(result.message);
      }
    } catch (printError) {
      const message = printError instanceof Error ? printError.message : "Failed to print receipt.";
      error(message);
    }
  }

  async function submitSale() {
    if (!cart.length) return;
    const payload = {
      customerId: customerId || undefined,
      paymentMethod,
      cashAmount: paymentMethod === "CASH" || paymentMethod === "SPLIT" ? cashAmount : undefined,
      qrAmount: paymentMethod === "QR" || paymentMethod === "SPLIT" ? qrAmount : undefined,
      orderDiscount: orderDiscountValue ? { type: orderDiscountType, value: orderDiscountValue } : undefined,
      items: cart.map((line) => ({
        productId: line.productId,
        qty: line.qty,
        itemDiscount: line.discountValue
          ? { type: line.discountType ?? "FIXED", value: line.discountValue }
          : undefined
      }))
    };

    if (!navigator.onLine) {
      const snapshot = buildSaleSnapshot(undefined, false);
      await db.pendingOps.add({
        opId: crypto.randomUUID(),
        type: "SALE",
        payload,
        status: "pending",
        retries: 0,
        createdAt: new Date().toISOString()
      });
      setCompletedSale(snapshot);
      setCart([]);
      return;
    }
    const response = await fetch("/api/pos/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error ?? "Failed to create sale");
      return;
    }
    const data = await response.json();
    const snapshot = buildSaleSnapshot(data.number, true);
    setCompletedSale(snapshot);
    setCart([]);
    await loadTransactions();
    const shouldPrint = window.confirm(
      `Sale ${data.number} completed. Do you want to print the sale transaction now?`
    );
    if (shouldPrint) {
      await printSaleTransaction(snapshot);
    }
  }

  async function postAction(action: "void" | "refund", transactionId: string) {
    const response = await fetch(`/api/pos/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId })
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error ?? "Action failed");
      return;
    }
    await loadTransactions();
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card">
        <h2>Quick Item Search / Barcode</h2>
        <input
          autoFocus
          placeholder="Scan barcode or type SKU/name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div style={{ maxHeight: 420, overflow: "auto", marginTop: 8 }}>
          {filtered.map((product) => (
            <button
              key={product.id}
              style={{ marginBottom: 8, textAlign: "left" }}
              onClick={() => addProduct(product)}
            >
              {product.name} ({product.sku}) - PHP {product.sellingPrice.toFixed(2)}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Cart</h2>
        <div className="grid">
          {cart.map((line) => (
            <div key={line.productId} className="card">
              <strong>{line.name}</strong>
              <div className="row">
                <input
                  type="text"
                  inputMode="numeric"
                  value={line.qty}
                  onChange={(event) =>
                    setCart((prev) =>
                      prev.map((row) =>
                        row.productId === line.productId
                          ? { ...row, qty: Number(normalizeIntegerInput(sanitizeIntegerInput(event.target.value))) }
                          : row
                      )
                    )
                  }
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={line.discountValue ?? 0}
                  onChange={(event) =>
                    setCart((prev) =>
                      prev.map((row) =>
                        row.productId === line.productId
                          ? { ...row, discountValue: toNumber(sanitizeDecimalInput(event.target.value)), discountType: "FIXED" }
                          : row
                      )
                    )
                  }
                  placeholder="Item discount"
                />
                <button
                  type="button"
                  onClick={() => setCart((prev) => prev.filter((row) => row.productId !== line.productId))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Walk-in customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
            <option value="CASH">Cash</option>
            <option value="QR">QR</option>
            <option value="SPLIT">Split</option>
          </select>
          {(paymentMethod === "CASH" || paymentMethod === "SPLIT") && (
            <input
              type="text"
              inputMode="decimal"
              value={cashAmount}
              onChange={(event) => setCashAmount(toNumber(sanitizeDecimalInput(event.target.value)))}
              onBlur={(event) => setCashAmount(toNumber(normalizeDecimalInput(event.target.value)))}
              placeholder="Cash amount"
            />
          )}
          {(paymentMethod === "QR" || paymentMethod === "SPLIT") && (
            <input
              type="text"
              inputMode="decimal"
              value={qrAmount}
              onChange={(event) => setQrAmount(toNumber(sanitizeDecimalInput(event.target.value)))}
              onBlur={(event) => setQrAmount(toNumber(normalizeDecimalInput(event.target.value)))}
              placeholder="QR amount"
            />
          )}
          <div className="row">
            <select
              value={orderDiscountType}
              onChange={(event) => setOrderDiscountType(event.target.value as "PERCENT" | "FIXED")}
            >
              <option value="FIXED">Order discount fixed</option>
              <option value="PERCENT">Order discount %</option>
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={orderDiscountValue}
              onChange={(event) => setOrderDiscountValue(toNumber(sanitizeDecimalInput(event.target.value)))}
              onBlur={(event) => setOrderDiscountValue(toNumber(normalizeDecimalInput(event.target.value)))}
              placeholder="Order discount"
            />
          </div>
          <div className="card">
            <div>Discount: PHP {totals.discount.toFixed(2)}</div>
            <h3>Total: PHP {totals.total.toFixed(2)}</h3>
          </div>
          <button onClick={submitSale}>Complete Sale</button>
        </div>
        {completedSale ? (
          <div className="card" style={{ marginTop: 10 }}>
            <h3>Receipt</h3>
            <div>
              {completedSale.txNumber ? `Transaction ${completedSale.txNumber}` : "Pending Sync Transaction"}
            </div>
            <div>{completedSale.synced ? "Saved online." : "Saved offline. Will sync later."}</div>
            <button onClick={() => void printSaleTransaction()}>Print Sale Transaction</button>
          </div>
        ) : null}
      </div>
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2>Recent Transactions</h2>
        <button onClick={loadTransactions}>Refresh</button>
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.number}</td>
                <td>{transaction.status}</td>
                <td>PHP {Number(transaction.totalAmount).toFixed(2)}</td>
                <td>
                  {session?.user.role === "OWNER" || session?.user.role === "MANAGER" ? (
                    <div className="row">
                      <button onClick={() => postAction("void", transaction.id)}>Void</button>
                      <button onClick={() => postAction("refund", transaction.id)}>Refund</button>
                    </div>
                  ) : (
                    "Not allowed"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {completedSale ? (
        <div className="print-receipt" aria-hidden>
          <div className="receipt-brand">MICROBIZ STORE</div>
          <div className="receipt-meta">{new Date(completedSale.createdAt).toLocaleDateString("en-PH")}</div>
          <div className="receipt-meta">{new Date(completedSale.createdAt).toLocaleTimeString("en-PH")}</div>
          <div className="receipt-meta">
            {completedSale.txNumber ? `TXN ${completedSale.txNumber}` : "PENDING SYNC TXN"}
          </div>
          <div className="receipt-meta">
            {completedSale.customerName ? `CUSTOMER: ${completedSale.customerName}` : "CUSTOMER: WALK-IN"}
          </div>
          <div className="receipt-divider" />
          <div className="receipt-head">
            <span>QTY</span>
            <span>DESC</span>
            <span>AMT</span>
          </div>
          <div className="receipt-divider" />
          {completedSale.items.map((item) => (
            <div key={`${item.name}-${item.qty}`} className="receipt-row">
              <span>{item.qty}</span>
              <span>{item.name}</span>
              <span>PHP {item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="receipt-divider" />
          <div className="receipt-total-row">
            <span>SUBTOTAL</span>
            <span>PHP {completedSale.subtotal.toFixed(2)}</span>
          </div>
          <div className="receipt-total-row">
            <span>DISCOUNT</span>
            <span>PHP {completedSale.discount.toFixed(2)}</span>
          </div>
          <div className="receipt-total-row receipt-grand">
            <span>TOTAL</span>
            <span>PHP {completedSale.total.toFixed(2)}</span>
          </div>
          <div className="receipt-total-row">
            <span>PAYMENT</span>
            <span>{completedSale.paymentMethod}</span>
          </div>
          {completedSale.cashAmount != null ? (
            <div className="receipt-total-row">
              <span>CASH</span>
              <span>PHP {completedSale.cashAmount.toFixed(2)}</span>
            </div>
          ) : null}
          {completedSale.qrAmount != null ? (
            <div className="receipt-total-row">
              <span>QR</span>
              <span>PHP {completedSale.qrAmount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="receipt-divider" />
          <div className="receipt-foot">Thank you for your purchase.</div>
        </div>
      ) : null}
    </div>
  );
}
