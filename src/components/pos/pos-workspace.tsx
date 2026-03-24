"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/offline-db";
import { applyDiscount } from "@/lib/pricing";
import { ProductGrid } from "@/components/pos/product-grid";
import { CategoryTabs } from "@/components/pos/category-tabs";
import { CartPanel } from "@/components/pos/cart-panel";
import { PaymentModal } from "@/components/pos/payment-modal";
import { CartLine, CustomerLite, HoldOrder, ProductLite } from "@/components/pos/types";
import { SecondaryButton } from "@/components/ui/buttons";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/toast-provider";

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

type TransactionRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: string;
  createdAt?: string;
};

export function PosWorkspace({
  products,
  customers
}: {
  products: ProductLite[];
  customers: CustomerLite[];
}) {
  const { data: session } = useSession();
  const { success } = useToast();
  const [view, setView] = useState<"pos" | "transactions">("pos");
  const [enableProductCategories, setEnableProductCategories] = useState(true);
  const [enableCompatibleUnits, setEnableCompatibleUnits] = useState(true);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [qrAmount, setQrAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [orderDiscountType, setOrderDiscountType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [holds, setHolds] = useState<HoldOrder[]>([]);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch =
        !enableProductCategories || activeCategory === "All" || product.category === activeCategory;
      const queryMatch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.barcode?.toLowerCase().includes(q);
      return categoryMatch && queryMatch;
    });
  }, [activeCategory, enableProductCategories, products, query]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.category).filter(Boolean))) as string[];
  }, [products]);
  const visibleCategories = useMemo(() => ["All", ...categoryOptions], [categoryOptions]);
  const showCategoryFilters = enableProductCategories && categoryOptions.length > 0;
  const compactCategoryFilters = visibleCategories.length <= 4;

  const subtotal = cart.reduce((acc, line) => acc + line.qty * line.price, 0);
  const lineNet = cart.reduce((acc, line) => {
    const base = line.qty * line.price;
    const discount = applyDiscount(base, undefined);
    return acc + discount.final;
  }, 0);
  const orderDiscount = applyDiscount(lineNet, {
    type: orderDiscountType,
    value: orderDiscountValue
  });
  const total = orderDiscount.final;
  const discount = orderDiscount.amount;

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

    async function loadProductSettings() {
      const response = await fetch("/api/settings");
      if (!response.ok) return;
      const payload = await response.json();
      if (!mounted) return;
      setEnableProductCategories(payload.enableProductCategories !== false);
      setEnableCompatibleUnits(payload.enableCompatibleUnits !== false);
      setEnableLowStockAlerts(payload.enableLowStockAlerts !== false);
      setLowStockThreshold(Number(payload.lowStockThreshold ?? 10));
    }

    void loadProductSettings();
    const handleSettingsUpdated = () => {
      void loadProductSettings();
    };
    window.addEventListener("microbiz:settings-updated", handleSettingsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("microbiz:settings-updated", handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!enableProductCategories) {
      setActiveCategory("All");
    }
  }, [enableProductCategories]);

  useEffect(() => {
    if (view === "pos") {
      inputRef.current?.focus();
    }
  }, [view]);

  useEffect(() => {
    if (!paymentOpen) return;
    setAmountPaid(total);
    setCashAmount(total);
    setQrAmount(0);
  }, [paymentOpen, total]);

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

  function resetOrderState() {
    setCart([]);
    setCustomerId("");
    setOrderDiscountType("FIXED");
    setOrderDiscountValue(0);
    setPaymentMethod(PaymentMethod.CASH);
    setCashAmount(0);
    setQrAmount(0);
    setAmountPaid(0);
  }

  function onNewSale() {
    resetOrderState();
    setView("pos");
    inputRef.current?.focus();
  }

  function holdOrder() {
    if (!cart.length) return;
    const hold: HoldOrder = {
      id: crypto.randomUUID(),
      label: `Hold ${new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`,
      createdAt: new Date().toISOString(),
      cart,
      customerId,
      orderDiscountType,
      orderDiscountValue,
      paymentMethod
    };
    setHolds((prev) => [hold, ...prev]);
    resetOrderState();
  }

  function resumeHold(holdId: string) {
    const target = holds.find((h) => h.id === holdId);
    if (!target) return;
    setCart(target.cart);
    setCustomerId(target.customerId);
    setOrderDiscountType(target.orderDiscountType);
    setOrderDiscountValue(target.orderDiscountValue);
    setPaymentMethod(target.paymentMethod);
    setHolds((prev) => prev.filter((h) => h.id !== holdId));
    setView("pos");
  }

  function buildSaleSnapshot(txNumber?: string, synced = true): CompletedSale {
    const customer = customers.find((row) => row.id === customerId);
    const splitCash = paymentMethod === "SPLIT" ? cashAmount : paymentMethod === "CASH" ? amountPaid : 0;
    const splitQr = paymentMethod === "SPLIT" ? qrAmount : paymentMethod === "QR" ? amountPaid : 0;
    return {
      txNumber,
      synced,
      createdAt: new Date().toISOString(),
      customerName: customer?.name,
      paymentMethod,
      cashAmount: splitCash || undefined,
      qrAmount: splitQr || undefined,
      subtotal,
      discount,
      total,
      items: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        lineTotal: line.qty * line.price
      }))
    };
  }

  function printSaleTransaction() {
    window.print();
    success("Transaction printed successfully");
  }

  async function completeSale() {
    if (!cart.length) return;
    const paidAmount = paymentMethod === "SPLIT" ? cashAmount + qrAmount : amountPaid;
    if (paidAmount < total) {
      alert("Amount paid is less than total.");
      return;
    }
    const payload = {
      customerId: customerId || undefined,
      paymentMethod,
      cashAmount:
        paymentMethod === "CASH"
          ? amountPaid
          : paymentMethod === "SPLIT"
            ? cashAmount
            : undefined,
      qrAmount:
        paymentMethod === "QR"
          ? amountPaid
          : paymentMethod === "SPLIT"
            ? qrAmount
            : undefined,
      orderDiscount: orderDiscountValue
        ? { type: orderDiscountType, value: orderDiscountValue }
        : undefined,
      items: cart.map((line) => ({
        productId: line.productId,
        qty: line.qty
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
      setPaymentOpen(false);
      resetOrderState();
      success("Processed successfully");
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
    setCompletedSale(buildSaleSnapshot(data.number, true));
    setPaymentOpen(false);
    resetOrderState();
    await loadTransactions();
    success("Processed successfully");
    const shouldPrint = window.confirm(
      `Sale ${data.number} completed. Do you want to print the sale transaction now?`
    );
    if (shouldPrint) {
      printSaleTransaction();
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
    success("Process successful");
  }

  return (
    <div className="pos-workspace">
      <div className="pos-toolbar">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (filteredProducts[0]) {
                addProduct(filteredProducts[0]);
              }
            }
          }}
          placeholder="Search name / SKU / barcode and press Enter"
        />
        <div className="pos-toolbar-actions">
          <SecondaryButton onClick={onNewSale}>Add Sale</SecondaryButton>
          {view === "pos" ? (
            <SecondaryButton onClick={() => setView("transactions")}>Transactions</SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => setView("pos")}>Back to POS</SecondaryButton>
          )}
        </div>
      </div>

      {view === "pos" && showCategoryFilters ? (
        <div
          className={
            compactCategoryFilters ? "pos-category-filter-bar pos-category-filter-bar-compact" : "pos-category-filter-bar"
          }
        >
          <CategoryTabs
            categories={visibleCategories}
            selected={activeCategory}
            onSelect={setActiveCategory}
          />
        </div>
      ) : null}

      {view === "pos" ? (
        <div className="pos-layout">
          <section className="pos-left">
            <ProductGrid
              products={filteredProducts}
              showCompatibleUnits={enableCompatibleUnits}
              showLowStockAlerts={enableLowStockAlerts}
              lowStockThreshold={lowStockThreshold}
              onAdd={addProduct}
            />
          </section>
          <CartPanel
            cart={cart}
            orderDiscountType={orderDiscountType}
            orderDiscountValue={orderDiscountValue}
            subtotal={subtotal}
            discount={discount}
            total={total}
            holds={holds}
            onSetOrderDiscountType={setOrderDiscountType}
            onSetOrderDiscountValue={setOrderDiscountValue}
            onIncrementQty={(productId) =>
              setCart((prev) =>
                prev.map((line) =>
                  line.productId === productId ? { ...line, qty: line.qty + 1 } : line
                )
              )
            }
            onDecrementQty={(productId) =>
              setCart((prev) =>
                prev
                  .map((line) =>
                    line.productId === productId ? { ...line, qty: line.qty - 1 } : line
                  )
                  .filter((line) => line.qty > 0)
              )
            }
            onRemoveLine={(productId) =>
              setCart((prev) => prev.filter((line) => line.productId !== productId))
            }
            onHoldOrder={holdOrder}
            onCancelOrder={resetOrderState}
            onResumeHold={resumeHold}
            onOpenPayment={() => {
              if (!cart.length) return;
              setPaymentOpen(true);
            }}
          />
        </div>
      ) : (
        <div className="card">
          <div className="pos-transactions-head">
            <h2 className="section-title">Transactions</h2>
            <SecondaryButton onClick={loadTransactions}>Refresh</SecondaryButton>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.number}</td>
                    <td>{row.status}</td>
                    <td>PHP {Number(row.totalAmount).toFixed(2)}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString("en-PH") : "-"}</td>
                    <td>
                      {session?.user.role === "OWNER" || session?.user.role === "MANAGER" ? (
                        <div className="row">
                          <button className="btn-secondary" onClick={() => postAction("void", row.id)}>
                            Void
                          </button>
                          <button className="btn-secondary" onClick={() => postAction("refund", row.id)}>
                            Refund
                          </button>
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
        </div>
      )}

      <PaymentModal
        open={paymentOpen}
        total={total}
        paymentMethod={paymentMethod}
        amountPaid={amountPaid}
        cashAmount={cashAmount}
        qrAmount={qrAmount}
        onClose={() => setPaymentOpen(false)}
        onConfirm={completeSale}
        onSetPaymentMethod={(value) => {
          setPaymentMethod(value);
          if (value === "CASH" || value === "QR") {
            setAmountPaid(total);
          }
        }}
        onSetAmountPaid={setAmountPaid}
        onSetCashAmount={setCashAmount}
        onSetQrAmount={setQrAmount}
      />

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
