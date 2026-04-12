"use client";

import type { ReceiptData, ReceiptSettings, ReceiptSource } from "@/lib/receipt/types";
import { buildReceiptData } from "@/lib/receipt/formatters";
import { buildEscPosReceipt } from "@/lib/receipt/escpos";
import { printRawCommands } from "@/lib/qz/print";

export type PosPrintSettings = {
  receiptSettings: ReceiptSettings;
  preferredPrinterName?: string;
  browserPrintFallback?: boolean;
};

export type PrintSaleReceiptOptions = {
  sale: ReceiptSource;
  settings: PosPrintSettings;
  onBrowserPrint?: (payload: { receipt: ReceiptData; sale: ReceiptSource }) => void | Promise<void>;
};

export async function printSaleReceipt({
  sale,
  settings,
  onBrowserPrint
}: PrintSaleReceiptOptions) {
  const receipt = buildReceiptData(sale, settings.receiptSettings);

  try {
    const rawCommands = buildEscPosReceipt(receipt, 48);
    const printer = await printRawCommands(rawCommands, settings.preferredPrinterName);
    return {
      mode: "qz" as const,
      printer,
      receipt
    };
  } catch (error) {
    if (settings.browserPrintFallback && onBrowserPrint) {
      await onBrowserPrint({ receipt, sale });
      return {
        mode: "browser" as const,
        receipt,
        error: error instanceof Error ? error : new Error("QZ printing failed.")
      };
    }
    throw error;
  }
}
