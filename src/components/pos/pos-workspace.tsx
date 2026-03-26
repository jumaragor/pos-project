"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PaymentMethod, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/offline-db";
import { ProductGrid } from "@/components/pos/product-grid";
import { CategoryTabs } from "@/components/pos/category-tabs";
import { CartPanel } from "@/components/pos/cart-panel";
import { CheckoutModal } from "@/components/pos/checkout-modal";
import { ReceiptPrint } from "@/components/pos/receipt-print";
import { CartLine, CustomerLite, ProductLite } from "@/components/pos/types";
import { SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency } from "@/lib/format";
import { buildReceiptData, ReceiptSettings, ReceiptSource } from "@/lib/receipt";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/toast-provider";

type ReceiptRecord = ReceiptSource;

type TransactionRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: string;
  createdAt?: string;
  customer?: { name: string } | null;
};

const defaultReceiptSettings: ReceiptSettings = {
  businessName: "",
  storeName: "MicroBiz POS",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "Thank you for shopping!",
  tin: "",
  permitNo: "",
  showCashierName: true,
  showCustomerName: true,
  showChangeAmount: true,
  enableTax: true,
  defaultTaxRate: 12,
  taxLabel: "VAT",
  taxInclusivePricing: false
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
  const [allowProductPhotoUpload, setAllowProductPhotoUpload] = useState(true);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(defaultReceiptSettings);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftNumber, setActiveDraftNumber] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [completedSale, setCompletedSale] = useState<ReceiptRecord | null>(null);
  const [receiptReady, setReceiptReady] = useState<ReceiptRecord | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
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
  const total = subtotal;
  const discount = 0;
  const totalItems = cart.reduce((acc, line) => acc + line.qty, 0);
  const printableReceipt = useMemo(
    () => (completedSale ? buildReceiptData(completedSale, receiptSettings) : null),
    [completedSale, receiptSettings]
  );

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
      setAllowProductPhotoUpload(payload.allowProductPhotoUpload !== false);
      setEnableLowStockAlerts(payload.enableLowStockAlerts !== false);
      setLowStockThreshold(Number(payload.lowStockThreshold ?? 10));
      setAutoPrintReceipt(payload.autoPrintReceipt === true);
      setReceiptSettings({
        businessName: String(payload.businessName ?? ""),
        storeName: String(payload.storeName ?? "MicroBiz POS"),
        storeAddress: String(payload.storeAddress ?? ""),
        storeContactNumber: String(payload.storeContactNumber ?? ""),
        storeEmailAddress: String(payload.storeEmailAddress ?? ""),
        storeLogoUrl: String(payload.storeLogoUrl ?? ""),
        receiptFooterMessage: String(payload.receiptFooterMessage ?? "Thank you for shopping!"),
        tin: String(payload.tin ?? ""),
        permitNo: String(payload.permitNo ?? ""),
        showCashierName: payload.showCashierName !== false,
        showCustomerName: payload.showCustomerName !== false,
        showChangeAmount: payload.showChangeAmount !== false,
        enableTax: payload.enableTax !== false,
        defaultTaxRate: Number(payload.defaultTaxRate ?? 12),
        taxLabel: String(payload.taxLabel ?? "VAT"),
        taxInclusivePricing: payload.taxInclusivePricing === true
      });
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
    setActiveDraftId(null);
    setActiveDraftNumber(null);
    setCheckoutOpen(false);
    setIsConfirmingCheckout(false);
  }

  function onNewSale() {
    resetOrderState();
    setReceiptReady(null);
    setView("pos");
    inputRef.current?.focus();
  }

  function buildSaleSnapshot(amountPaid: number, txNumber?: string, synced = true): ReceiptRecord {
    const customer = customers.find((row) => row.id === customerId);
    return {
      txNumber,
      synced,
      createdAt: new Date().toISOString(),
      customerName: customer?.name,
      cashierName: session?.user.name ?? session?.user.username ?? undefined,
      paymentMethod: PaymentMethod.CASH,
      cashAmount: amountPaid,
      qrAmount: 0,
      subtotal,
      discount,
      discountTotal: discount,
      taxAmount: 0,
      total,
      items: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        unitPrice: line.price,
        lineTotal: line.qty * line.price
      }))
    };
  }

  function printSaleTransaction(sale: ReceiptRecord | null = receiptReady ?? completedSale) {
    if (!sale) return;
    setCompletedSale(sale);
    window.print();
    success("Transaction printed successfully");
  }

  async function loadReceiptRecord(transactionId: string) {
    const response = await fetch(`/api/pos/transactions/${transactionId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load receipt");
    }
    const receipt: ReceiptRecord = {
      txNumber: data.number,
      synced: true,
      createdAt: data.createdAt,
      customerName: data.customerName ?? undefined,
      cashierName: data.cashierName ?? data.cashierUsername ?? undefined,
      paymentMethod: data.paymentMethod,
      cashAmount: data.cashAmount ?? undefined,
      qrAmount: data.qrAmount ?? undefined,
      subtotal: Number(data.totalAmount) - Number(data.discountTotal ?? 0),
      discount: Number(data.discountTotal ?? 0),
      discountTotal: Number(data.discountTotal ?? 0),
      taxAmount: Number(data.taxAmount ?? 0),
      total: Number(data.totalAmount),
      items: (data.items ?? []).map((item: { name: string; qty: number; price?: number; lineTotal: number }) => ({
        name: item.name,
        qty: Number(item.qty),
        unitPrice: Number(item.price ?? 0),
        lineTotal: Number(item.lineTotal)
      }))
    };
    setCompletedSale(receipt);
    setReceiptReady(receipt);
    return receipt;
  }

  async function completeSale(amountPaid: number) {
    if (!cart.length) return;
    if (amountPaid < total) {
      alert("Insufficient amount");
      return;
    }

    setIsConfirmingCheckout(true);

    const payload = {
      customerId: customerId || undefined,
      paymentMethod: PaymentMethod.CASH,
      cashAmount: amountPaid,
      draftId: activeDraftId || undefined,
      items: cart.map((line) => ({
        productId: line.productId,
        qty: line.qty,
        price: line.price
      }))
    };

    try {
      if (!navigator.onLine) {
        const snapshot = buildSaleSnapshot(amountPaid, undefined, false);
        await db.pendingOps.add({
          opId: crypto.randomUUID(),
          type: "SALE",
          payload,
          status: "pending",
          retries: 0,
          createdAt: new Date().toISOString()
        });
        setCompletedSale(snapshot);
        setReceiptReady(snapshot);
        resetOrderState();
        success("Sale saved for sync");
        inputRef.current?.focus();
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
      const snapshot = buildSaleSnapshot(amountPaid, data.number, true);
      setCompletedSale(snapshot);
      setReceiptReady(snapshot);
      resetOrderState();
      await loadTransactions();
      success(`Sale ${data.number} completed`);
      inputRef.current?.focus();
      if (autoPrintReceipt) {
        window.setTimeout(() => {
          printSaleTransaction(snapshot);
        }, 50);
      }
    } finally {
      setIsConfirmingCheckout(false);
    }
  }

  async function holdOrder() {
    if (!cart.length) return;
    const response = await fetch("/api/pos/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customerId || undefined,
        paymentMethod: PaymentMethod.CASH,
        draftId: activeDraftId || undefined,
        items: cart.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          price: line.price
        }))
      })
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error ?? "Failed to hold order");
      return;
    }
    resetOrderState();
    await loadTransactions();
    success("Changes saved successfully");
  }

  async function resumeHeldOrder(transactionId: string) {
    if (cart.length && !window.confirm("Replace the current cart with this held order?")) {
      return;
    }
    const response = await fetch(`/api/pos/transactions/${transactionId}`);
    const data = await response.json();
    if (!response.ok) {
      alert(data.error ?? "Failed to load held order");
      return;
    }
    setCustomerId(data.customerId ?? "");
    setActiveDraftId(data.id);
    setActiveDraftNumber(data.number ?? null);
    setCart(
      (data.items ?? []).map((item: { productId: string; name: string; qty: number; price: number }) => ({
        productId: item.productId,
        name: item.name,
        qty: Number(item.qty),
        price: Number(item.price)
      }))
    );
    setCompletedSale(null);
    setReceiptReady(null);
    setCheckoutOpen(false);
    setView("pos");
    inputRef.current?.focus();
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

  async function printTransaction(transactionId: string) {
    try {
      const receipt = await loadReceiptRecord(transactionId);
      window.setTimeout(() => {
        printSaleTransaction(receipt);
      }, 50);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to print receipt");
    }
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
        <>
          {receiptReady ? (
            <div className="card pos-receipt-banner">
              <div className="pos-receipt-banner-copy">
                <strong>{receiptReady.txNumber ? `Sale ${receiptReady.txNumber} completed` : "Sale completed"}</strong>
                <span className="muted">Receipt is ready. You can print now or continue with the next sale.</span>
              </div>
              <div className="row pos-receipt-banner-actions">
                <SecondaryButton onClick={() => printSaleTransaction(receiptReady)}>
                  Print Receipt
                </SecondaryButton>
                <SecondaryButton onClick={() => setReceiptReady(null)}>
                  Dismiss
                </SecondaryButton>
              </div>
            </div>
          ) : null}
        <div className="pos-layout">
          <section className="pos-left">
            <ProductGrid
              products={filteredProducts}
              showProductPhotos={allowProductPhotoUpload}
              showCompatibleUnits={enableCompatibleUnits}
              showLowStockAlerts={enableLowStockAlerts}
              lowStockThreshold={lowStockThreshold}
              onAdd={addProduct}
            />
          </section>
          <CartPanel
            cart={cart}
            total={total}
            orderLabel={activeDraftNumber ? `Order ${activeDraftNumber}` : "New Order"}
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
            onClearCart={resetOrderState}
            onHoldOrder={() => void holdOrder()}
            onOpenCheckout={() => {
              if (!cart.length) return;
              setCheckoutOpen(true);
            }}
          />
        </div>
        </>
      ) : (
        <div className="card">
          <div className="pos-transactions-head">
            <h2 className="section-title">Transactions</h2>
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
                    <td>{row.status === TransactionStatus.DRAFT ? "HELD" : row.status}</td>
                    <td>{formatCurrency(row.totalAmount)}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString("en-PH") : "-"}</td>
                    <td>
                      {row.status === TransactionStatus.DRAFT ? (
                        <div className="row">
                          <button className="btn-secondary" onClick={() => void resumeHeldOrder(row.id)}>
                            Resume
                          </button>
                        </div>
                      ) : session?.user.role === "OWNER" || session?.user.role === "MANAGER" ? (
                        <div className="row">
                          <button className="btn-secondary" onClick={() => void printTransaction(row.id)}>
                            {row.status === TransactionStatus.COMPLETED ? "Print" : "Reprint"}
                          </button>
                          <button className="btn-secondary" onClick={() => postAction("void", row.id)}>
                            Void
                          </button>
                          <button className="btn-secondary" onClick={() => postAction("refund", row.id)}>
                            Refund
                          </button>
                        </div>
                      ) : row.status === TransactionStatus.COMPLETED || row.status === TransactionStatus.REFUNDED || row.status === TransactionStatus.VOID ? (
                        <div className="row">
                          <button className="btn-secondary" onClick={() => void printTransaction(row.id)}>
                            {row.status === TransactionStatus.COMPLETED ? "Print" : "Reprint"}
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

      <CheckoutModal
        open={checkoutOpen}
        total={total}
        itemCount={totalItems}
        confirming={isConfirmingCheckout}
        onClose={() => {
          if (isConfirmingCheckout) return;
          setCheckoutOpen(false);
        }}
        onConfirm={completeSale}
      />

      {printableReceipt ? <ReceiptPrint data={printableReceipt} /> : null}
    </div>
  );
}
