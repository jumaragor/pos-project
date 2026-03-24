import { useEffect, useState } from "react";
import { PaymentMethod } from "@prisma/client";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { normalizeDecimalInput, sanitizeDecimalInput, toNumber } from "@/lib/numeric-input";

type PaymentModalProps = {
  open: boolean;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  cashAmount: number;
  qrAmount: number;
  onClose: () => void;
  onConfirm: () => void;
  onSetPaymentMethod: (value: PaymentMethod) => void;
  onSetAmountPaid: (value: number) => void;
  onSetCashAmount: (value: number) => void;
  onSetQrAmount: (value: number) => void;
};

export function PaymentModal(props: PaymentModalProps) {
  const {
    open,
    total,
    paymentMethod,
    amountPaid,
    cashAmount,
    qrAmount,
    onClose,
    onConfirm,
    onSetPaymentMethod,
    onSetAmountPaid,
    onSetCashAmount,
    onSetQrAmount
  } = props;
  const [amountPaidInput, setAmountPaidInput] = useState(String(amountPaid));
  const [cashInput, setCashInput] = useState(String(cashAmount));
  const [qrInput, setQrInput] = useState(String(qrAmount));

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setAmountPaidInput(String(amountPaid));
    setCashInput(String(cashAmount));
    setQrInput(String(qrAmount));
  }, [open, amountPaid, cashAmount, qrAmount]);

  if (!open) return null;

  const splitTotal = cashAmount + qrAmount;
  const paid = paymentMethod === "SPLIT" ? splitTotal : amountPaid;
  const change = Math.max(paid - total, 0);

  return (
    <div className="pos-modal-overlay" role="dialog" aria-modal="true">
      <div className="pos-modal">
        <h3 className="section-title">Payment</h3>
        <div className="stack">
          <select
            value={paymentMethod}
            onChange={(event) => onSetPaymentMethod(event.target.value as PaymentMethod)}
          >
            <option value="CASH">Cash</option>
            <option value="QR">QR</option>
            <option value="SPLIT">Split</option>
          </select>

          {paymentMethod !== "SPLIT" ? (
            <input
              type="text"
              inputMode="decimal"
              value={amountPaidInput}
              onChange={(event) => {
                const next = sanitizeDecimalInput(event.target.value);
                setAmountPaidInput(next);
                onSetAmountPaid(toNumber(next));
              }}
              onBlur={() => {
                const normalized = normalizeDecimalInput(amountPaidInput);
                setAmountPaidInput(normalized);
                onSetAmountPaid(toNumber(normalized));
              }}
              placeholder="Amount paid"
            />
          ) : (
            <div className="row">
              <input
                type="text"
                inputMode="decimal"
                value={cashInput}
                onChange={(event) => {
                  const next = sanitizeDecimalInput(event.target.value);
                  setCashInput(next);
                  onSetCashAmount(toNumber(next));
                }}
                onBlur={() => {
                  const normalized = normalizeDecimalInput(cashInput);
                  setCashInput(normalized);
                  onSetCashAmount(toNumber(normalized));
                }}
                placeholder="Cash amount"
              />
              <input
                type="text"
                inputMode="decimal"
                value={qrInput}
                onChange={(event) => {
                  const next = sanitizeDecimalInput(event.target.value);
                  setQrInput(next);
                  onSetQrAmount(toNumber(next));
                }}
                onBlur={() => {
                  const normalized = normalizeDecimalInput(qrInput);
                  setQrInput(normalized);
                  onSetQrAmount(toNumber(normalized));
                }}
                placeholder="QR amount"
              />
            </div>
          )}
        </div>
        <div className="pos-payment-summary">
          <div>
            <span>Total</span>
            <strong>PHP {total.toFixed(2)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>PHP {paid.toFixed(2)}</strong>
          </div>
          <div>
            <span>Change</span>
            <strong>PHP {change.toFixed(2)}</strong>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton onClick={onConfirm}>Complete Sale</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
