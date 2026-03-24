-- Initial MicroBiz schema.
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'CASHIER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QR', 'SPLIT');
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'VOID', 'REFUNDED');
CREATE TYPE "StockMovementType" AS ENUM ('SALE', 'REFUND', 'STOCK_IN', 'ADJUSTMENT', 'REPACK_IN', 'REPACK_OUT');
CREATE TYPE "PendingOpType" AS ENUM ('SALE', 'ADJUSTMENT', 'REPACK');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "barcode" TEXT UNIQUE,
  "costPrice" DECIMAL(12,2) NOT NULL,
  "sellingPrice" DECIMAL(12,2) NOT NULL,
  "stockQty" DECIMAL(12,3) NOT NULL,
  "lowStockThreshold" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Customer" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Transaction" (
  "id" TEXT PRIMARY KEY,
  "number" TEXT NOT NULL UNIQUE,
  "customerId" TEXT,
  "userId" TEXT NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "discountTotal" DECIMAL(12,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "cashAmount" DECIMAL(12,2),
  "qrAmount" DECIMAL(12,2),
  "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TransactionItem" (
  "id" TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qty" DECIMAL(12,3) NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "costAtSale" DECIMAL(12,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL
);

CREATE TABLE "StockMovement" (
  "id" TEXT PRIMARY KEY,
  "type" "StockMovementType" NOT NULL,
  "productId" TEXT NOT NULL,
  "qtyDelta" DECIMAL(12,3) NOT NULL,
  "reason" TEXT,
  "refId" TEXT,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UnitConversionRule" (
  "id" TEXT PRIMARY KEY,
  "fromUnit" TEXT NOT NULL,
  "toUnit" TEXT NOT NULL,
  "factor" DECIMAL(12,3) NOT NULL,
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadataJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SyncOperation" (
  "id" TEXT PRIMARY KEY,
  "opId" TEXT NOT NULL UNIQUE,
  "opType" "PendingOpType" NOT NULL,
  "status" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AppSetting" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UnitConversionRule" ADD CONSTRAINT "UnitConversionRule_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
