import { useEffect, useState } from "react";
import { CartLine, HoldOrder } from "@/components/pos/types";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { normalizeDecimalInput, sanitizeDecimalInput, toNumber } from "@/lib/numeric-input";

type CartPanelProps = {
  cart: CartLine[];
  orderDiscountType: "PERCENT" | "FIXED";
  orderDiscountValue: number;
  subtotal: number;
  discount: number;
  total: number;
  holds: HoldOrder[];
  onSetOrderDiscountType: (value: "PERCENT" | "FIXED") => void;
  onSetOrderDiscountValue: (value: number) => void;
  onIncrementQty: (productId: string) => void;
  onDecrementQty: (productId: string) => void;
  onRemoveLine: (productId: string) => void;
  onHoldOrder: () => void;
  onCancelOrder: () => void;
  onResumeHold: (holdId: string) => void;
  onOpenPayment: () => void;
};

export function CartPanel(props: CartPanelProps) {
  const {
    cart,
    orderDiscountType,
    orderDiscountValue,
    subtotal,
    discount,
    total,
    holds,
    onSetOrderDiscountType,
    onSetOrderDiscountValue,
    onIncrementQty,
    onDecrementQty,
    onRemoveLine,
    onHoldOrder,
    onCancelOrder,
    onResumeHold,
    onOpenPayment
  } = props;
  const [discountInput, setDiscountInput] = useState(String(orderDiscountValue));

  useEffect(() => {
    setDiscountInput(String(orderDiscountValue));
  }, [orderDiscountValue]);

  return (
    <aside className="pos-checkout-panel">
      <div className="pos-checkout-head">
        <h2 className="section-title">Checkout</h2>
        <span className="badge">{cart.length} item(s)</span>
      </div>

      <div className="pos-cart-list">
        {cart.map((line) => (
          <div key={line.productId} className="pos-cart-line">
            <div className="pos-cart-line-main">
              <div className="pos-cart-name">{line.name}</div>
              <div className="pos-cart-subtotal">PHP {(line.qty * line.price).toFixed(2)}</div>
            </div>
            <div className="pos-cart-line-actions">
              <button type="button" className="qty-btn" onClick={() => onDecrementQty(line.productId)}>
                -
              </button>
              <span className="qty-count">{line.qty}</span>
              <button type="button" className="qty-btn" onClick={() => onIncrementQty(line.productId)}>
                +
              </button>
              <button type="button" className="trash-btn" onClick={() => onRemoveLine(line.productId)}>
                x
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pos-discount-row">
        <select
          value={orderDiscountType}
          onChange={(event) => onSetOrderDiscountType(event.target.value as "PERCENT" | "FIXED")}
        >
          <option value="FIXED">Discount (Fixed)</option>
          <option value="PERCENT">Discount (%)</option>
        </select>
        <input
          type="text"
          inputMode="decimal"
          value={discountInput}
          onChange={(event) => {
            const next = sanitizeDecimalInput(event.target.value);
            setDiscountInput(next);
            onSetOrderDiscountValue(toNumber(next));
          }}
          onBlur={() => {
            const normalized = normalizeDecimalInput(discountInput);
            setDiscountInput(normalized);
            onSetOrderDiscountValue(toNumber(normalized));
          }}
        />
      </div>

      <div className="pos-summary">
        <div>
          <span>Subtotal</span>
          <strong>PHP {subtotal.toFixed(2)}</strong>
        </div>
        <div>
          <span>Tax</span>
          <strong>PHP 0.00</strong>
        </div>
        <div>
          <span>Discount</span>
          <strong>PHP {discount.toFixed(2)}</strong>
        </div>
        <div className="pos-summary-total">
          <span>Total</span>
          <strong>PHP {total.toFixed(2)}</strong>
        </div>
      </div>

      {holds.length ? (
        <div className="pos-hold-list">
          <div className="muted">Held Orders</div>
          {holds.map((hold) => (
            <button key={hold.id} type="button" className="btn-secondary" onClick={() => onResumeHold(hold.id)}>
              {hold.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pos-sticky-actions">
        <button type="button" className="btn-danger" onClick={onCancelOrder}>
          Cancel Order
        </button>
        <SecondaryButton onClick={onHoldOrder}>Hold Order</SecondaryButton>
        <PrimaryButton onClick={onOpenPayment}>Pay (PHP {total.toFixed(2)})</PrimaryButton>
      </div>
    </aside>
  );
}
