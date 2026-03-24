import { useState } from "react";
import { ProductLite } from "@/components/pos/types";

type ProductGridProps = {
  products: ProductLite[];
  showCompatibleUnits?: boolean;
  showLowStockAlerts?: boolean;
  lowStockThreshold?: number;
  onAdd: (product: ProductLite) => void;
};

function ProductImage({ product }: { product: ProductLite }) {
  const [failed, setFailed] = useState(false);
  const hasPhoto = Boolean(product.photoUrl) && !failed;
  if (hasPhoto) {
    return (
      <div className="pos-product-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.photoUrl ?? ""}
          alt={product.name}
          className="pos-product-image-content"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return <div className="pos-product-image pos-product-image-placeholder">IMG</div>;
}

export function ProductGrid({
  products,
  showCompatibleUnits = true,
  showLowStockAlerts = true,
  lowStockThreshold = 0,
  onAdd
}: ProductGridProps) {
  return (
    <div className="pos-product-grid">
      {products.map((product) => {
        const lowStock = showLowStockAlerts && product.stockQty <= lowStockThreshold;
        return (
          <button key={product.id} type="button" className="pos-product-card" onClick={() => onAdd(product)}>
            <ProductImage product={product} />
            <div className="pos-product-name">{product.name}</div>
            <div className="pos-product-meta">
              <span className="pos-product-price">PHP {product.sellingPrice.toFixed(2)}</span>
              {lowStock ? <span className="pos-stock-badge">Low Stock</span> : null}
            </div>
            <div className="pos-product-sku">{product.sku}</div>
            {showCompatibleUnits && product.compatibleUnits ? (
              <div className="pos-product-guide">{product.compatibleUnits}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
