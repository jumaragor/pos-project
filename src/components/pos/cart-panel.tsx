import { CartLine } from "@/components/pos/types";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { TrashIcon } from "@/components/ui/app-icons";
import { formatCurrency } from "@/lib/format";

type CartPanelProps = {
  cart: CartLine[];
  total: number;
  orderLabel: string;
  onIncrementQty: (productId: string) => void;
  onDecrementQty: (productId: string) => void;
  onRemoveLine: (productId: string) => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onOpenCheckout: () => void;
};

export function CartPanel(props: CartPanelProps) {
  const {
    cart,
    total,
    orderLabel,
    onIncrementQty,
    onDecrementQty,
    onRemoveLine,
    onClearCart,
    onHoldOrder,
    onOpenCheckout
  } = props;

  return (
    <aside className="pos-checkout-panel">
      <div className="pos-checkout-head">
        <div className="pos-checkout-head-copy">
          <h2 className="section-title">Checkout</h2>
          <div className="pos-checkout-order-meta">
            <span className="pos-checkout-order-label">{orderLabel}</span>
            <span className="pos-checkout-order-divider" aria-hidden>
              |
            </span>
            <span className="pos-checkout-order-count">{cart.length} item(s)</span>
          </div>
        </div>
      </div>

      <div className="pos-cart-list">
        {cart.map((line) => (
          <div key={line.productId} className="pos-cart-line">
            <div className="pos-cart-line-main">
              <div className="pos-cart-line-info">
                <div className="pos-cart-name">{line.name}</div>
              </div>
              <div className="pos-cart-line-meta">
                <div className="pos-cart-subtotal">{formatCurrency(line.qty * line.price)}</div>
                <div className="pos-cart-line-actions">
                  <div className="pos-cart-qty-group">
                    <button type="button" className="qty-btn" onClick={() => onDecrementQty(line.productId)}>
                      -
                    </button>
                    <span className="qty-count">{line.qty}</span>
                    <button type="button" className="qty-btn" onClick={() => onIncrementQty(line.productId)}>
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="trash-btn"
                    onClick={() => onRemoveLine(line.productId)}
                    aria-label={`Remove ${line.name}`}
                    title="Remove item"
                  >
                    <TrashIcon className="trash-btn-icon" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pos-summary pos-summary-simple">
        <div className="pos-summary-total">
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>

      <div className="pos-sticky-actions">
        <div className="stack">
          <SecondaryButton onClick={onHoldOrder} disabled={!cart.length}>
            Hold Order
          </SecondaryButton>
          <SecondaryButton onClick={onClearCart} disabled={!cart.length}>
            Cancel Order
          </SecondaryButton>
          <PrimaryButton onClick={onOpenCheckout} disabled={!cart.length}>
            Checkout
          </PrimaryButton>
        </div>
      </div>
    </aside>
  );
}
