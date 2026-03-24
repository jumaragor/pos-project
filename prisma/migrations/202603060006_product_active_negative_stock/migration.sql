-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
