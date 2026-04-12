import { PaymentMethod } from "@prisma/client";
import type { ReceiptData } from "@/lib/receipt/types";

const ESC = "\x1B";
const GS = "\x1D";
const LINE_WIDTH = 42;
const MIN_RIGHT_WIDTH = 10;
const MAX_RIGHT_WIDTH = 16;
const TITLE_DOUBLE_SIZE = false;

export function sanitizeText(text: string | undefined | null) {
  if (!text) return "";

  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function truncate(text: string, width: number) {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}

export function divider(width = LINE_WIDTH) {
  return "-".repeat(width);
}

export function center(text: string, width = LINE_WIDTH) {
  const safe = truncate(sanitizeText(text), width);
  const totalPadding = Math.max(0, width - safe.length);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${" ".repeat(leftPadding)}${safe}${" ".repeat(rightPadding)}`;
}

export function wrap(text: string, width = LINE_WIDTH) {
  const safe = sanitizeText(text);
  if (!safe) return [];

  const words = safe.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = "";
      }

      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export function leftRight(left: string, right: string, width = LINE_WIDTH) {
  const safeLeft = sanitizeText(left);
  const safeRight = sanitizeText(right);

  if (!safeRight) {
    return truncate(safeLeft, width);
  }

  const rightWidth = Math.max(
    MIN_RIGHT_WIDTH,
    Math.min(MAX_RIGHT_WIDTH, safeRight.length)
  );
  const fittedRight = truncate(safeRight, rightWidth);
  const leftWidth = Math.max(1, width - fittedRight.length - 1);
  const fittedLeft = truncate(safeLeft, leftWidth);
  const gap = Math.max(1, width - fittedLeft.length - fittedRight.length);

  return `${fittedLeft}${" ".repeat(gap)}${fittedRight}`;
}

function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case PaymentMethod.CASH:
      return "Cash";
    case PaymentMethod.QR:
      return "QR";
    case PaymentMethod.SPLIT:
      return "Split";
    default:
      return "Payment";
  }
}

const commands = {
  init: () => `${ESC}@`,
  alignLeft: () => `${ESC}a\x00`,
  alignCenter: () => `${ESC}a\x01`,
  boldOn: () => `${ESC}E\x01`,
  boldOff: () => `${ESC}E\x00`,
  sizeNormal: () => `${GS}!\x00`,
  sizeWide: () => `${GS}!\x01`,
  sizeTall: () => `${GS}!\x10`,
  sizeDouble: () => `${GS}!\x11`,
  feed: (lines = 1) => "\n".repeat(Math.max(0, lines)),
  cut: () => `${GS}V\x00`
};

function pushLine(lines: string[], text = "") {
  lines.push(`${text}\n`);
}

function pushWrapped(lines: string[], text: string | undefined, width = LINE_WIDTH, centered = false) {
  const wrapped = wrap(text ?? "", width);
  if (!wrapped.length) return;

  for (const line of wrapped) {
    pushLine(lines, centered ? center(line, width) : line);
  }
}

export function buildEscPosReceipt(receipt: ReceiptData, lineWidth = LINE_WIDTH) {
  const createdAt = new Date(receipt.createdAt);
  const dateText = createdAt.toLocaleDateString("en-PH");
  const timeText = createdAt.toLocaleTimeString("en-PH");
  const receiptLines: string[] = [];

  receiptLines.push(commands.init());
  receiptLines.push(commands.alignCenter());
  receiptLines.push(commands.boldOn());
  receiptLines.push(TITLE_DOUBLE_SIZE ? commands.sizeDouble() : commands.sizeTall());
  receiptLines.push("ORDER SLIP\n");
  receiptLines.push(commands.sizeNormal());
  receiptLines.push(commands.boldOff());
  receiptLines.push(commands.feed());
  receiptLines.push(commands.alignLeft());

  pushLine(receiptLines, divider(lineWidth));
  pushLine(receiptLines, leftRight(dateText, receipt.transactionNumber ?? "-", lineWidth));
  pushLine(receiptLines, leftRight(timeText, receipt.cashierName ?? "-", lineWidth));
  pushLine(receiptLines, divider(lineWidth));

  for (const item of receipt.items) {
    pushWrapped(receiptLines, item.name, lineWidth);
    pushLine(
      receiptLines,
      leftRight(
        `${item.qty} x ${formatMoney(item.unitPrice)}`,
        formatMoney(item.lineTotal),
        lineWidth
      )
    );
  }

  pushLine(receiptLines, divider(lineWidth));
  pushLine(receiptLines, leftRight("Subtotal", formatMoney(receipt.subtotal), lineWidth));
  if (receipt.discount > 0) {
    pushLine(receiptLines, leftRight("Discount", formatMoney(receipt.discount), lineWidth));
  }
  if (receipt.taxAmount && receipt.taxAmount > 0) {
    pushLine(
      receiptLines,
      leftRight(receipt.taxLabel ?? "Tax", formatMoney(receipt.taxAmount), lineWidth)
    );
  }

  receiptLines.push(commands.boldOn());
  pushLine(receiptLines, leftRight("TOTAL", formatMoney(receipt.total), lineWidth));
  receiptLines.push(commands.boldOff());
  pushLine(receiptLines, divider(lineWidth));

  const receivedAmount =
    receipt.paymentMethod === PaymentMethod.QR ? receipt.qrReceived : receipt.cashReceived;
  pushLine(
    receiptLines,
    leftRight(paymentMethodLabel(receipt.paymentMethod), formatMoney(receivedAmount ?? receipt.total), lineWidth)
  );
  if (receipt.changeAmount != null) {
    pushLine(receiptLines, leftRight("Change", formatMoney(receipt.changeAmount), lineWidth));
  }

  receiptLines.push(commands.feed());
  receiptLines.push(commands.alignCenter());
  pushWrapped(receiptLines, receipt.footerMessage ?? "Thank you for shopping!", lineWidth, true);
  receiptLines.push(commands.alignLeft());
  receiptLines.push(commands.feed(4));
  receiptLines.push(commands.cut());

  return receiptLines.join("");
}
