import { formatCurrency, formatNumber } from "@/lib/format";
import { ReceiptData } from "@/lib/receipt";

const PRINT_COPIES = 1;
const RECEIPT_LINE_WIDTH = 32;

function truncateReceiptText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 1)}~`;
}

function formatReceiptMetaRow(left: string, right?: string) {
  const safeLeft = left.trim();
  const safeRight = right?.trim() ?? "";

  if (!safeRight) {
    return truncateReceiptText(safeLeft, RECEIPT_LINE_WIDTH);
  }

  const minimumGap = 2;
  const maxRightWidth = Math.floor(RECEIPT_LINE_WIDTH * 0.5);
  const trimmedRight = truncateReceiptText(safeRight, maxRightWidth);
  const availableLeftWidth = Math.max(8, RECEIPT_LINE_WIDTH - trimmedRight.length - minimumGap);
  const trimmedLeft = truncateReceiptText(safeLeft, availableLeftWidth);
  const gapWidth = Math.max(minimumGap, RECEIPT_LINE_WIDTH - trimmedLeft.length - trimmedRight.length);

  return `${trimmedLeft}${" ".repeat(gapWidth)}${trimmedRight}`;
}

function ReceiptCopy({ data }: { data: ReceiptData }) {
  const formattedDate = new Date(data.createdAt);
  const footerNote = "This is not an official receipt";
  const metaRows = [
    formatReceiptMetaRow(
      formattedDate.toLocaleDateString("en-PH"),
      data.transactionNumber ?? undefined
    ),
    formatReceiptMetaRow(
      formattedDate.toLocaleTimeString("en-PH"),
      data.cashierName ?? undefined
    )
  ];

  return (
    <section className="receipt-copy">
      {data.businessName ? <div className="receipt-brand">{data.businessName}</div> : null}
      <div className="receipt-divider" />
      <div className="receipt-meta-compact">
        {metaRows.map((row, index) => (
          <div key={`${row}-${index}`} className="receipt-meta-line">
            {row}
          </div>
        ))}
      </div>
      <div className="receipt-divider" />
      <div className="receipt-head">
        <span>QTY</span>
        <span>DESC</span>
        <span>AMT</span>
      </div>
      <div className="receipt-divider" />
      {data.items.map((item, index) => (
        <div key={`${item.name}-${item.qty}-${item.lineTotal}-${index}`} className="receipt-row">
          <span>{formatNumber(item.qty)}</span>
          <span className="receipt-item-copy">
            <strong>{item.name}</strong>
            <small>@ {formatCurrency(item.unitPrice)}</small>
          </span>
          <span>{formatCurrency(item.lineTotal)}</span>
        </div>
      ))}
      <div className="receipt-divider" />
      <div className="receipt-total-row">
        <span>SUBTOTAL</span>
        <span>{formatCurrency(data.subtotal)}</span>
      </div>
      {data.discount > 0 ? (
        <div className="receipt-total-row">
          <span>DISCOUNT</span>
          <span>{formatCurrency(data.discount)}</span>
        </div>
      ) : null}
      {data.taxAmount != null && data.taxAmount > 0 ? (
        <div className="receipt-total-row">
          <span>
            {data.taxLabel}
            {data.taxRate != null ? ` (${formatNumber(data.taxRate)}%)` : ""}
          </span>
          <span>{formatCurrency(data.taxAmount)}</span>
        </div>
      ) : null}
      <div className="receipt-total-row receipt-grand">
        <span>TOTAL</span>
        <span>{formatCurrency(data.total)}</span>
      </div>
      <div className="receipt-total-row">
        <span>PAYMENT</span>
        <span>{data.paymentMethod}</span>
      </div>
      {data.cashReceived != null ? (
        <div className="receipt-total-row">
          <span>CASH</span>
          <span>{formatCurrency(data.cashReceived)}</span>
        </div>
      ) : null}
      {data.qrReceived != null && data.qrReceived > 0 ? (
        <div className="receipt-total-row">
          <span>QR</span>
          <span>{formatCurrency(data.qrReceived)}</span>
        </div>
      ) : null}
      {data.changeAmount != null ? (
        <div className="receipt-total-row">
          <span>CHANGE</span>
          <span>{formatCurrency(data.changeAmount)}</span>
        </div>
      ) : null}
      <div className="receipt-divider" />
      <div className="receipt-foot">{footerNote}</div>
      {data.footerMessage && data.footerMessage !== footerNote ? (
        <div className="receipt-foot">{data.footerMessage}</div>
      ) : null}
    </section>
  );
}

export function ReceiptPrint({ data }: { data: ReceiptData }) {
  return (
    <div className="print-receipt" aria-hidden>
      {Array.from({ length: PRINT_COPIES }).map((_, index) => (
        <ReceiptCopy key={`receipt-copy-${index}`} data={data} />
      ))}
    </div>
  );
}
