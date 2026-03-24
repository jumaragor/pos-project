-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "skuPrefix" TEXT NOT NULL,
    "description" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

-- Seed default category rows from existing product categories
INSERT INTO "Category" ("id", "name", "code", "skuPrefix", "description", "status", "sortOrder", "createdAt", "updatedAt")
SELECT
  'cat_' || md5("category"),
  "category",
  UPPER(LEFT(REGEXP_REPLACE("category", '[^A-Za-z0-9]+', '', 'g'), 6)),
  UPPER(LEFT(REGEXP_REPLACE("category", '[^A-Za-z0-9]+', '', 'g'), 6)),
  NULL,
  'ACTIVE'::"CategoryStatus",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT COALESCE(NULLIF(TRIM("category"), ''), 'GENERAL') AS "category"
  FROM "Product"
) categories;

-- Backfill categoryId on products
UPDATE "Product" p
SET "categoryId" = c."id"
FROM "Category" c
WHERE UPPER(TRIM(p."category")) = UPPER(TRIM(c."name"));

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_skuPrefix_key" ON "Category"("skuPrefix");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
