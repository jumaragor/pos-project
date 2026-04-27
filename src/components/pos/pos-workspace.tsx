"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PaymentMethod, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/offline-db";
import { ProductGrid } from "@/components/pos/product-grid";
import { CategoryTabs } from "@/components/pos/category-tabs";
import { CartPanel } from "@/components/pos/cart-panel";
import { CheckoutModal } from "@/components/pos/checkout-modal";
import { ReceiptPrint } from "@/components/pos/receipt-print";
import { CartLine, ProductLite } from "@/components/pos/types";
import { SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency } from "@/lib/format";
import { isPrintBridgeConfigured, printReceiptViaBridge } from "@/lib/print-bridge";
import { buildReceiptData, ReceiptSettings, ReceiptSource } from "@/lib/receipt";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/toast-provider";

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ReceiptRecord = ReceiptSource;

type TransactionRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: string;
  createdAt?: string;
  user?: { name?: string | null; username?: string | null } | null;
};

type PosWorkspaceSettings = {
  enableProductCategories: boolean;
  enableCompatibleUnits: boolean;
  allowProductPhotoUpload: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  allowDiscountEntry: boolean;
  autoPrintReceipt: boolean;
  productDisplayMode: "tile" | "line";
  posProductsPerPage: number;
  receiptSettings: ReceiptSettings;
};

const defaultReceiptSettings: ReceiptSettings = {
  businessName: "",
  storeName: "MicroBiz POS",
  storeAddress: "",
  storeContactNumber: "",
  storeEmailAddress: "",
  storeLogoUrl: "",
  receiptFooterMessage: "",
  tin: "",
  permitNo: "",
  showCashierName: true,
  showChangeAmount: true,
  enableTax: true,
  defaultTaxRate: 12,
  taxLabel: "VAT",
  taxInclusivePricing: false
};

export function PosWorkspace({
  initialProducts,
  initialPagination,
  initialCategoryOptions,
  initialSettings
}: {
  initialProducts: ProductLite[];
  initialPagination: PaginationState;
  initialCategoryOptions: string[];
  initialSettings: PosWorkspaceSettings;
}) {
  const { data: session } = useSession();
  const { success, warning } = useToast();
  const [view, setView] = useState<"pos" | "transactions">("pos");
  const [enableProductCategories, setEnableProductCategories] = useState(initialSettings.enableProductCategories);
  const [enableCompatibleUnits, setEnableCompatibleUnits] = useState(initialSettings.enableCompatibleUnits);
  const [allowProductPhotoUpload, setAllowProductPhotoUpload] = useState(initialSettings.allowProductPhotoUpload);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(initialSettings.enableLowStockAlerts);
  const [lowStockThreshold, setLowStockThreshold] = useState(initialSettings.lowStockThreshold);
  const [allowDiscountEntry, setAllowDiscountEntry] = useState(initialSettings.allowDiscountEntry);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(initialSettings.autoPrintReceipt);
  const [productDisplayMode, setProductDisplayMode] = useState<"tile" | "line">(initialSettings.productDisplayMode);
  const [productsPerPage, setProductsPerPage] = useState(initialSettings.posProductsPerPage);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(
    initialSettings.receiptSettings ?? defaultReceiptSettings
  );
  const [products, setProducts] = useState<ProductLite[]>(initialProducts);
  const [productPagination, setProductPagination] = useState<PaginationState>(initialPagination);
  const [categoryOptions] = useState<string[]>(initialCategoryOptions);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftNumber, setActiveDraftNumber] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState("");
  const [completedSale, setCompletedSale] = useState<ReceiptRecord | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRow[]>([]);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [queuedPrintId, setQueuedPrintId] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPrintedIdRef = useRef(0);
  const hasSkippedInitialProductFetchRef = useRef(false);
  const visibleCategories = useMemo(() => ["All", ...categoryOptions], [categoryOptions]);
  const showCategoryFilters = enableProductCategories && categoryOptions.length > 0;
  const compactCategoryFilters = visibleCategories.length <= 4;
  const productPageSize = Math.max(1, productsPerPage || 50);
  const totalProductPages = Math.max(1, productPagination.totalPages || 1);

  const subtotal = cart.reduce((acc, line) => acc + line.qty * line.price, 0);
  const parsedDiscount = Math.max(0, Number(discountInput || 0));
  const discount = allowDiscountEntry ? Math.min(parsedDiscount, subtotal) : 0;
  const discountInvalid = allowDiscountEntry && parsedDiscount > subtotal;
  const total = Math.max(subtotal - discount, 0);
  const totalItems = cart.reduce((acc, line) => acc + line.qty, 0);
  const printableReceipt = useMemo(
    () => (completedSale ? buildReceiptData(completedSale, receiptSettings) : null),
    [completedSale, receiptSettings]
  );

  async function loadTransactions() {
    setLoadingTransactions(true);
    try {
      const response = await fetch("/api/pos/transactions");
      const data = await response.json();
      setRecentTransactions(data);
      setTransactionsLoaded(true);
    } finally {
      setLoadingTransactions(false);
    }
  }

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
      setAllowDiscountEntry(payload.allowDiscountEntry !== false);
      setAutoPrintReceipt(payload.autoPrintReceipt === true);
      setProductDisplayMode(payload.productDisplayMode === "line" ? "line" : "tile");
      setProductsPerPage(Math.max(1, Number(payload.posProductsPerPage ?? 50)));
      setReceiptSettings({
        businessName: String(payload.businessName ?? ""),
        storeName: String(payload.storeName ?? "MicroBiz POS"),
        storeAddress: String(payload.storeAddress ?? ""),
        storeContactNumber: String(payload.storeContactNumber ?? ""),
        storeEmailAddress: String(payload.storeEmailAddress ?? ""),
        storeLogoUrl: String(payload.storeLogoUrl ?? ""),
        receiptFooterMessage: String(payload.receiptFooterMessage ?? ""),
        tin: String(payload.tin ?? ""),
        permitNo: String(payload.permitNo ?? ""),
        showCashierName: payload.showCashierName !== false,
        showChangeAmount: payload.showChangeAmount !== false,
        enableTax: payload.enableTax !== false,
        defaultTaxRate: Number(payload.defaultTaxRate ?? 12),
        taxLabel: String(payload.taxLabel ?? "VAT"),
        taxInclusivePricing: payload.taxInclusivePricing === true
      });
    }

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
    setProductPage(1);
  }, [activeCategory, productPageSize, query]);

  useEffect(() => {
    setProductPage((prev) => Math.min(prev, totalProductPages));
  }, [totalProductPages]);

  useEffect(() => {
    if (!hasSkippedInitialProductFetchRef.current) {
      hasSkippedInitialProductFetchRef.current = true;
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingProducts(true);
      try {
        const params = new URLSearchParams({
          page: String(productPage),
          pageSize: String(productPageSize)
        });
        if (query.trim()) {
          params.set("q", query.trim());
        }
        if (enableProductCategories && activeCategory !== "All") {
          params.set("category", activeCategory);
        }

        const response = await fetch(`/api/pos/products?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          items: ProductLite[];
          pagination: PaginationState;
        };
        if (controller.signal.aborted) return;
        setProducts(payload.items);
        setProductPagination(payload.pagination);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load POS products", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      }
    }, query.trim() ? 180 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeCategory, enableProductCategories, productPage, productPageSize, query]);

  useEffect(() => {
    if (view === "pos") {
      inputRef.current?.focus();
    }
  }, [view]);

  useEffect(() => {
    if (view !== "transactions" || transactionsLoaded || loadingTransactions) return;
    void loadTransactions();
  }, [loadingTransactions, transactionsLoaded, view]);

  useEffect(() => {
    if (!queuedPrintId || queuedPrintId === lastPrintedIdRef.current || !printableReceipt) {
      return;
    }

    let frameOne = 0;
    let frameTwo = 0;

    const receipt = printableReceipt;

    async function printQueuedReceipt() {
      lastPrintedIdRef.current = queuedPrintId;

      if (isPrintBridgeConfigured()) {
        try {
          await printReceiptViaBridge(receipt);
          success("Receipt sent to printer");
          return;
        } catch (printError) {
          console.warn("Printer bridge failed; falling back to browser print.", printError);
          warning("Printer bridge unavailable. Opening browser print instead.");
        }
      }

      window.print();
    }

    // Wait for the shared receipt component to mount before printing or using browser fallback.
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        void printQueuedReceipt();
      });
    });

    return () => {
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [printableReceipt, queuedPrintId, success, warning]);

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
    setDiscountInput("");
    setActiveDraftId(null);
    setActiveDraftNumber(null);
    setCheckoutOpen(false);
    setIsConfirmingCheckout(false);
  }

  function onNewSale() {
    resetOrderState();
    setView("pos");
    inputRef.current?.focus();
  }

  function buildSaleSnapshot(amountPaid: number, txNumber?: string, synced = true): ReceiptRecord {
    return {
      txNumber,
      synced,
      createdAt: new Date().toISOString(),
      customerName: undefined,
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

  function queueSaleTransactionPrint(sale: ReceiptRecord | null = completedSale) {
    if (!sale) return;
    setCompletedSale(sale);
    setQueuedPrintId((current) => current + 1);
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
    return receipt;
  }

  async function completeSale(amountPaid: number) {
    if (!cart.length) return;
    if (discountInvalid) {
      alert("Discount cannot be greater than the subtotal.");
      return;
    }
    if (amountPaid < total) {
      alert("Insufficient amount");
      return;
    }

    setIsConfirmingCheckout(true);

    const payload = {
      paymentMethod: PaymentMethod.CASH,
      cashAmount: amountPaid,
      draftId: activeDraftId || undefined,
      orderDiscount: discount > 0 ? { type: "FIXED" as const, value: discount } : undefined,
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
      resetOrderState();
      await loadTransactions();
      success(`Sale ${data.number} completed`);
      inputRef.current?.focus();
      if (autoPrintReceipt) {
        queueSaleTransactionPrint(snapshot);
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
        paymentMethod: PaymentMethod.CASH,
        draftId: activeDraftId || undefined,
        orderDiscount: discount > 0 ? { type: "FIXED" as const, value: discount } : undefined,
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
    setDiscountInput(
      Number(data.discountTotal ?? 0) > 0 ? String(Number(data.discountTotal).toFixed(2)) : ""
    );
    setCompletedSale(null);
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
      queueSaleTransactionPrint(receipt);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : "Failed to print receipt");
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
              if (products[0]) {
                addProduct(products[0]);
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
        <div className="pos-layout">
          <section className="pos-left">
            <ProductGrid
              products={products}
              displayMode={productDisplayMode}
              showProductPhotos={allowProductPhotoUpload}
              showCompatibleUnits={enableCompatibleUnits}
              showLowStockAlerts={enableLowStockAlerts}
              lowStockThreshold={lowStockThreshold}
              onAdd={addProduct}
            />
            {loadingProducts ? <div className="muted pos-products-loading">Loading products...</div> : null}
            <div className="inventory-pagination pos-product-pagination">
              <div>
                Showing {products.length ? (productPagination.page - 1) * productPagination.pageSize + 1 : 0} to{" "}
                {(productPagination.page - 1) * productPagination.pageSize + products.length} of{" "}
                {productPagination.total}
              </div>
              <div className="row">
                <button
                  className="btn-secondary"
                  disabled={productPage <= 1 || loadingProducts}
                  onClick={() => setProductPage((prev) => Math.max(prev - 1, 1))}
                >
                  Prev
                </button>
                <span className="badge">Page {productPage} / {totalProductPages}</span>
                <button
                  className="btn-secondary"
                  disabled={productPage >= totalProductPages || loadingProducts}
                  onClick={() => setProductPage((prev) => Math.min(prev + 1, totalProductPages))}
                >
                  Next
                </button>
              </div>
            </div>
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
                  <th>Cashier</th>
                  <th className="pos-actions-header">
                    <div className="pos-actions-header-inner">Actions</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingTransactions ? (
                  <tr>
                    <td colSpan={6} className="muted">Loading transactions...</td>
                  </tr>
                ) : recentTransactions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.number}</td>
                    <td>{row.status === TransactionStatus.DRAFT ? "HELD" : row.status}</td>
                    <td>{formatCurrency(row.totalAmount)}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString("en-PH") : "-"}</td>
                    <td>{row.user?.name?.trim() || row.user?.username?.trim() || "-"}</td>
                    <td className="pos-actions-cell">
                      {row.status === TransactionStatus.DRAFT ? (
                        <div className="pos-actions-group">
                          <button className="btn-secondary" onClick={() => void resumeHeldOrder(row.id)}>
                            Resume
                          </button>
                        </div>
                      ) : session?.user.role === "OWNER" || session?.user.role === "MANAGER" ? (
                        <div className="pos-actions-group">
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
                        <div className="pos-actions-group">
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
        subtotal={subtotal}
        total={total}
        allowDiscountEntry={allowDiscountEntry}
        discountInput={discountInput}
        discountAmount={discount}
        discountInvalid={discountInvalid}
        itemCount={totalItems}
        confirming={isConfirmingCheckout}
        onClose={() => {
          if (isConfirmingCheckout) return;
          setCheckoutOpen(false);
        }}
        onDiscountInputChange={setDiscountInput}
        onConfirm={completeSale}
      />
      {printableReceipt ? <ReceiptPrint data={printableReceipt} /> : null}
    </div>
  );
}
