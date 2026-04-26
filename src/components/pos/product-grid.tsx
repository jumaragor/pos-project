import { useState } from "react";
import { ProductLite } from "@/components/pos/types";
import { formatCurrency } from "@/lib/format";

type ProductGridProps = {
  products: ProductLite[];
  displayMode?: "tile" | "line";
  showProductPhotos?: boolean;
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
  displayMode = "tile",
  showProductPhotos = true,
  showCompatibleUnits = true,
  showLowStockAlerts = true,
  lowStockThreshold = 0,
  onAdd
}: ProductGridProps) {
  return (
    <div className={displayMode === "line" ? "pos-product-grid pos-product-grid-line" : "pos-product-grid"}>
      {products.map((product) => {
        const lowStock = showLowStockAlerts && product.stockQty <= lowStockThreshold;
        return (
          <button
            key={product.id}
            type="button"
            className={displayMode === "line" ? "pos-product-card pos-product-card-line" : "pos-product-card"}
            onClick={() => onAdd(product)}
            title={product.name}
          >
            {showProductPhotos ? <ProductImage product={product} /> : null}
            <div className={displayMode === "line" ? "pos-product-main" : ""}>
              <div className="pos-product-name" title={product.name}>
                {product.name}
              </div>
              {product.uomCode || product.uomName ? (
                <div className="pos-product-sku">{product.uomCode ?? product.uomName}</div>
              ) : null}
              {showCompatibleUnits && product.compatibleUnits ? (
                <div className="pos-product-guide">{product.compatibleUnits}</div>
              ) : null}
            </div>
            <div className={displayMode === "line" ? "pos-product-meta pos-product-meta-line" : "pos-product-meta"}>
              <span className="pos-product-price">{formatCurrency(product.sellingPrice)}</span>
              {lowStock ? <span className="pos-stock-badge">Low Stock</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
