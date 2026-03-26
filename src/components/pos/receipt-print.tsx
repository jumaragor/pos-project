import { formatCurrency, formatNumber } from "@/lib/format";
import { ReceiptData } from "@/lib/receipt";

export function ReceiptPrint({ data }: { data: ReceiptData }) {
  return (
    <div className="print-receipt" aria-hidden>
      <div className="receipt-brand">{data.businessName}</div>
      {data.tradeName ? <div className="receipt-meta">{data.tradeName}</div> : null}
      {data.address ? <div className="receipt-meta">{data.address}</div> : null}
      {data.contactNumber ? <div className="receipt-meta">TEL: {data.contactNumber}</div> : null}
      {data.email ? <div className="receipt-meta">{data.email}</div> : null}
      {data.tin ? <div className="receipt-meta">TIN: {data.tin}</div> : null}
      {data.permitNo ? <div className="receipt-meta">PERMIT: {data.permitNo}</div> : null}
      <div className="receipt-divider" />
      <div className="receipt-meta">{new Date(data.createdAt).toLocaleDateString("en-PH")}</div>
      <div className="receipt-meta">{new Date(data.createdAt).toLocaleTimeString("en-PH")}</div>
      {data.transactionNumber ? <div className="receipt-meta">TXN {data.transactionNumber}</div> : null}
      {data.cashierName ? <div className="receipt-meta">CASHIER: {data.cashierName}</div> : null}
      {data.customerName ? <div className="receipt-meta">CUSTOMER: {data.customerName}</div> : null}
      <div className="receipt-divider" />
      <div className="receipt-head">
        <span>QTY</span>
        <span>DESC</span>
        <span>AMT</span>
      </div>
      <div className="receipt-divider" />
      {data.items.map((item) => (
        <div key={`${item.name}-${item.qty}-${item.lineTotal}`} className="receipt-row">
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
      {data.footerMessage ? (
        <>
          <div className="receipt-divider" />
          <div className="receipt-foot">{data.footerMessage}</div>
        </>
      ) : null}
    </div>
  );
}
