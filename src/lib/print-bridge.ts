import type { ReceiptData } from "@/lib/receipt";

type PrintBridgeResponse = {
  success: boolean;
  message?: string;
  error?: {
    code?: string;
    details?: unknown;
  };
};

const DEFAULT_BRIDGE_URL = "http://localhost:17890";
const REQUEST_TIMEOUT_MS = 3500;

function bridgeUrl() {
  return (process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/+$/, "");
}

function bridgeToken() {
  return process.env.NEXT_PUBLIC_PRINT_BRIDGE_TOKEN || "";
}

function bridgePaperWidth() {
  const width = Number(process.env.NEXT_PUBLIC_PRINT_BRIDGE_PAPER_WIDTH || 80);
  return width === 58 ? 58 : 80;
}

function withTimeout(timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

function joinReceiptSubheader(receipt: ReceiptData) {
  return [receipt.tradeName, receipt.address, receipt.contactNumber, receipt.email]
    .filter(Boolean)
    .join(" | ");
}

function paymentLabel(receipt: ReceiptData) {
  const parts: string[] = [receipt.paymentMethod];
  if (receipt.cashReceived != null) parts.push(`Cash ${receipt.cashReceived.toFixed(2)}`);
  if (receipt.qrReceived != null && receipt.qrReceived > 0) parts.push(`QR ${receipt.qrReceived.toFixed(2)}`);
  if (receipt.changeAmount != null) parts.push(`Change ${receipt.changeAmount.toFixed(2)}`);
  return parts.join(" / ");
}

function toBridgeReceipt(receipt: ReceiptData) {
  return {
    header: receipt.businessName || "MicroBiz POS",
    subheader: joinReceiptSubheader(receipt),
    invoice: receipt.transactionNumber,
    cashier: receipt.cashierName,
    date: new Date(receipt.createdAt).toLocaleString("en-PH"),
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
    payment: paymentLabel(receipt),
    footer: receipt.footerMessage || "Thank you for your purchase."
  };
}

async function readBridgeResponse(response: Response) {
  try {
    return (await response.json()) as PrintBridgeResponse;
  } catch {
    return {
      success: response.ok,
      message: response.ok ? "Receipt sent to printer." : "Printer bridge returned an invalid response."
    };
  }
}

export function isPrintBridgeConfigured() {
  return Boolean(bridgeToken());
}

export async function checkPrintBridge() {
  const { controller, timeout } = withTimeout(1500);
  try {
    const response = await fetch(`${bridgeUrl()}/health`, {
      method: "GET",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function printReceiptViaBridge(receipt: ReceiptData) {
  const token = bridgeToken();
  if (!token) {
    throw new Error("Printer bridge token is not configured.");
  }

  const { controller, timeout } = withTimeout();

  try {
    const response = await fetch(`${bridgeUrl()}/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Print-Token": token
      },
      body: JSON.stringify({
        paperWidth: bridgePaperWidth(),
        receipt: toBridgeReceipt(receipt)
      }),
      signal: controller.signal
    });
    const payload = await readBridgeResponse(response);

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || payload.error?.code || "Failed to print receipt.");
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}
