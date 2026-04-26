import type { ReceiptData } from "@/lib/receipt";
import { isPrintBridgeConfigured, printReceiptViaBridge } from "@/lib/print-bridge";

export type PrintMode = "browser" | "windows-bridge" | "android-escpos-bridge";

export type PrintSettings = {
  printMode: PrintMode;
  androidBridgeUrl: string;
  androidBridgeHealthUrl: string;
  androidBridgeToken: string;
  enableBrowserPrintFallback: boolean;
};

export type PrintReceiptResult = {
  mode: PrintMode | "browser-fallback";
  message: string;
};

type AndroidBridgeResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

const DEFAULT_ANDROID_BRIDGE_URL = "http://127.0.0.1:17890";
const DEFAULT_ANDROID_BRIDGE_HEALTH_URL = `${DEFAULT_ANDROID_BRIDGE_URL}/health`;
const REQUEST_TIMEOUT_MS = 3500;

function cleanBridgeUrl(value: string) {
  return (value || DEFAULT_ANDROID_BRIDGE_URL).replace(/\/+$/, "");
}

function cleanHealthUrl(value: string, bridgeUrl: string) {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  return `${cleanBridgeUrl(bridgeUrl)}/health`;
}

function withTimeout(timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Printer bridge failed.";
}

function fallbackToBrowserPrint(reason?: string): PrintReceiptResult {
  window.print();
  return {
    mode: "browser-fallback",
    message: reason
      ? `${reason} Browser print opened instead.`
      : "Printer bridge unavailable. Browser print opened instead."
  };
}

function printViaBrowser(): PrintReceiptResult {
  window.print();
  return {
    mode: "browser",
    message: "Browser print opened."
  };
}

function toAndroidBridgeReceipt(receipt: ReceiptData) {
  return {
    storeName: receipt.businessName || receipt.tradeName || "MicroBiz POS",
    address: [receipt.address, receipt.contactNumber, receipt.email].filter(Boolean).join(" | "),
    receiptNo: receipt.transactionNumber || "",
    date: new Date(receipt.createdAt).toLocaleString("en-PH"),
    cashier: receipt.cashierName || "",
    items: receipt.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.unitPrice,
      total: item.lineTotal
    })),
    subtotal: receipt.subtotal,
    discount: receipt.discount,
    tax: receipt.taxAmount ?? 0,
    total: receipt.total,
    cash: receipt.cashReceived ?? receipt.total,
    change: receipt.changeAmount ?? 0,
    paymentMethod: receipt.paymentMethod
  };
}

async function readAndroidBridgeResponse(response: Response) {
  try {
    return (await response.json()) as AndroidBridgeResponse;
  } catch {
    return {
      success: response.ok,
      message: response.ok ? "Receipt sent to Android ESC/POS bridge." : "Android bridge returned an invalid response."
    };
  }
}

async function checkAndroidBridgeHealth(healthUrl: string) {
  const { controller, timeout } = withTimeout(1500);
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal
    });
    if (response.ok) return;

    if (healthUrl.endsWith("/health")) {
      const statusUrl = healthUrl.replace(/\/health$/, "/status");
      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        signal: controller.signal
      });
      if (statusResponse.ok) return;
      throw new Error(`Android ESC/POS bridge health check failed at ${healthUrl} and ${statusUrl}.`);
    }

    throw new Error(`Android ESC/POS bridge health check failed at ${healthUrl} with HTTP ${response.status}.`);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function printViaAndroidBridge(receipt: ReceiptData, settings: PrintSettings): Promise<PrintReceiptResult> {
  const token = settings.androidBridgeToken.trim();
  if (!token) {
    throw new Error("Android bridge token is not configured.");
  }

  const bridgeUrl = cleanBridgeUrl(settings.androidBridgeUrl);
  await checkAndroidBridgeHealth(cleanHealthUrl(settings.androidBridgeHealthUrl || DEFAULT_ANDROID_BRIDGE_HEALTH_URL, bridgeUrl));

  const { controller, timeout } = withTimeout();
  try {
    const response = await fetch(`${bridgeUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        receipt: toAndroidBridgeReceipt(receipt)
      }),
      signal: controller.signal
    });
    const payload = await readAndroidBridgeResponse(response);

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || payload.message || "Android bridge failed to print receipt.");
    }

    return {
      mode: "android-escpos-bridge",
      message: "Receipt printed successfully."
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function printViaWindowsBridge(receipt: ReceiptData): Promise<PrintReceiptResult> {
  if (!isPrintBridgeConfigured()) {
    throw new Error("Windows local bridge token is not configured.");
  }

  await printReceiptViaBridge(receipt);
  return {
    mode: "windows-bridge",
    message: "Receipt sent to Windows local bridge."
  };
}

export async function printReceipt(receipt: ReceiptData, settings: PrintSettings): Promise<PrintReceiptResult> {
  if (settings.printMode === "browser") {
    return printViaBrowser();
  }

  try {
    if (settings.printMode === "android-escpos-bridge") {
      return await printViaAndroidBridge(receipt, settings);
    }

    return await printViaWindowsBridge(receipt);
  } catch (error) {
    if (settings.enableBrowserPrintFallback) {
      return fallbackToBrowserPrint(errorMessage(error));
    }
    throw error;
  }
}
