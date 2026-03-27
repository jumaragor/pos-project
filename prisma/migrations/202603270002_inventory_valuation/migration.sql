CREATE TYPE "InventoryValuationMethod" AS ENUM ('STANDARD', 'FIFO');

CREATE TYPE "InventoryReferenceType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'REPACK');

ALTER TABLE "StockMovement"
ADD COLUMN "unitCost" DECIMAL(12,2),
ADD COLUMN "referenceType" "InventoryReferenceType";

CREATE TABLE "InventoryLayer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "remainingQty" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "referenceType" "InventoryReferenceType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLayer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryLayer"
ADD CONSTRAINT "InventoryLayer_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "InventoryLayer_productId_createdAt_idx"
ON "InventoryLayer"("productId", "createdAt");
