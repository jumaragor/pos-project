import { useEffect, useMemo, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { formatCurrency } from "@/lib/format";
import { sanitizeDecimalInput, toNumber } from "@/lib/numeric-input";

type CheckoutModalProps = {
  open: boolean;
  total: number;
  itemCount: number;
  confirming?: boolean;
  onClose: () => void;
  onConfirm: (amountPaid: number) => void;
};

const quickCashValues = [100, 200, 500, 1000];

export function CheckoutModal({
  open,
  total,
  itemCount,
  confirming = false,
  onClose,
  onConfirm
}: CheckoutModalProps) {
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountPaidInput("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "Enter") {
        const nextAmount = Math.max(0, toNumber(amountPaidInput));
        if (nextAmount >= total && !confirming) {
          onConfirm(nextAmount);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [amountPaidInput, confirming, onClose, onConfirm, open, total]);

  const amountPaid = useMemo(() => Math.max(0, toNumber(amountPaidInput)), [amountPaidInput]);
  const change = Math.max(amountPaid - total, 0);
  const insufficient = amountPaid < total;

  if (!open) return null;

  return (
    <div className="pos-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pos-modal checkout-modal" onClick={(event) => event.stopPropagation()}>
        <div className="checkout-modal-head">
          <h3 className="section-title">Checkout</h3>
          <button type="button" className="checkout-close-btn" onClick={onClose} aria-label="Close checkout">
            ×
          </button>
        </div>

        <div className="checkout-summary-card">
          <div className="checkout-summary-label">Total Amount</div>
          <div className="checkout-summary-total">{formatCurrency(total)}</div>
          <div className="checkout-summary-meta">{itemCount} item(s)</div>
        </div>

        <div className="form-field">
          <label className="field-label">Amount Paid</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amountPaidInput}
            onChange={(event) => setAmountPaidInput(sanitizeDecimalInput(event.target.value))}
          />
        </div>

        <div className="checkout-quick-cash">
          {quickCashValues.map((value) => (
            <button
              key={value}
              type="button"
              className="checkout-quick-btn"
              onClick={() => setAmountPaidInput(String((amountPaid + value).toFixed(2)))}
            >
              ₱{value}
            </button>
          ))}
        </div>

        <div className="checkout-display">
          <div>
            <span>Amount Paid</span>
            <strong>{formatCurrency(amountPaid)}</strong>
          </div>
          <div className={change > 0 ? "checkout-change-positive" : undefined}>
            <span>Change</span>
            <strong>{formatCurrency(change)}</strong>
          </div>
        </div>

        {insufficient ? <div className="checkout-warning">Insufficient amount</div> : null}

        <div className="row checkout-actions">
          <SecondaryButton onClick={onClose} disabled={confirming}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={() => onConfirm(amountPaid)} disabled={insufficient || confirming}>
            {confirming ? "Confirming..." : "Confirm Payment"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
