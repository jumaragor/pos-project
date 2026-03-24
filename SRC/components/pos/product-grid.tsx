import { useState } from "react";
import { ProductLite } from "@/components/pos/types";

type ProductGridProps = {
  products: ProductLite[];
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

export function ProductGrid({ products, onAdd }: ProductGridProps) {
  return (
    <div className="pos-product-grid">
      {products.map((product) => {
        const lowStock =
          typeof product.lowStockThreshold === "number" &&
          product.stockQty <= product.lowStockThreshold;
        return (
          <button key={product.id} type="button" className="pos-product-card" onClick={() => onAdd(product)}>
            <ProductImage product={product} />
            <div className="pos-product-name">{product.name}</div>
            <div className="pos-product-meta">
              <span className="pos-product-price">PHP {product.sellingPrice.toFixed(2)}</span>
              {lowStock ? <span className="pos-stock-badge">Low Stock</span> : null}
            </div>
            <div className="pos-product-sku">{product.sku}</div>
          </button>
        );
      })}
    </div>
  );
}
