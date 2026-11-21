CREATE TYPE "DebtEntryType" AS ENUM ('OPENING_BALANCE','MANUAL_DEBT','REPAYMENT','ADJUSTMENT','REVERSAL');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','MOBILE_MONEY','OTHER');
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_STOCK','STOCK_IN','ADJUSTMENT','REVERSAL');

CREATE TABLE "customers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "fullName" VARCHAR(150) NOT NULL, "phoneNumber" VARCHAR(20), "address" VARCHAR(300), "notes" VARCHAR(1000),
  "outstandingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK ("outstandingBalance" >= 0), "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_name_not_blank" CHECK (length(btrim("fullName")) > 0), UNIQUE ("id","shopId")
);
CREATE UNIQUE INDEX "customers_shop_phone_unique" ON "customers"("shopId","phoneNumber") WHERE "phoneNumber" IS NOT NULL;
CREATE INDEX "customers_shop_created_idx" ON "customers"("shopId","createdAt" DESC);
CREATE INDEX "customers_shop_name_idx" ON "customers"("shopId",lower("fullName"));
CREATE INDEX "customers_shop_balance_idx" ON "customers"("shopId","outstandingBalance");

CREATE TABLE "payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "customerId" UUID NOT NULL, "amount" DECIMAL(18,2) NOT NULL CHECK ("amount" > 0), "method" "PaymentMethod" NOT NULL,
  "reference" VARCHAR(120), "notes" VARCHAR(500), "receivedAt" TIMESTAMPTZ(3) NOT NULL, "reversedAt" TIMESTAMPTZ(3),
  "reversalReason" VARCHAR(500), "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("customerId","shopId") REFERENCES "customers"("id","shopId") ON DELETE RESTRICT
);
CREATE INDEX "payments_shop_customer_received_idx" ON "payments"("shopId","customerId","receivedAt" DESC);

CREATE TABLE "debt_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "customerId" UUID NOT NULL, "paymentId" UUID REFERENCES "payments"("id") ON DELETE RESTRICT, "type" "DebtEntryType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL CHECK ("amount" <> 0), "description" VARCHAR(500), "reversalOfId" UUID UNIQUE REFERENCES "debt_entries"("id") ON DELETE RESTRICT,
  "idempotencyKey" VARCHAR(120), "payloadHash" CHAR(64), "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("customerId","shopId") REFERENCES "customers"("id","shopId") ON DELETE RESTRICT,
  UNIQUE ("shopId","idempotencyKey")
);
CREATE INDEX "debt_entries_shop_customer_created_idx" ON "debt_entries"("shopId","customerId","createdAt" DESC);

CREATE TABLE "categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "name" VARCHAR(100) NOT NULL, "archivedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK (length(btrim("name")) > 0), UNIQUE ("id","shopId"), UNIQUE ("shopId","name")
);
CREATE INDEX "categories_shop_archived_idx" ON "categories"("shopId","archivedAt");

CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT, "categoryId" UUID,
  "name" VARCHAR(200) NOT NULL, "description" VARCHAR(500), "unit" VARCHAR(30) NOT NULL, "sellingPrice" DECIMAL(18,2) NOT NULL CHECK ("sellingPrice" >= 0),
  "costPrice" DECIMAL(18,2) CHECK ("costPrice" >= 0), "minimumStock" DECIMAL(18,3) NOT NULL DEFAULT 0 CHECK ("minimumStock" >= 0),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(btrim("name")) > 0), UNIQUE ("id","shopId"), UNIQUE ("shopId","name"),
  FOREIGN KEY ("categoryId","shopId") REFERENCES "categories"("id","shopId") ON DELETE RESTRICT
);
CREATE INDEX "products_shop_category_idx" ON "products"("shopId","categoryId");
CREATE INDEX "products_shop_active_idx" ON "products"("shopId","isActive");

CREATE TABLE "inventory_balances" (
  "productId" UUID PRIMARY KEY, "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0 CHECK ("quantity" >= 0), "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("productId","shopId") REFERENCES "products"("id","shopId") ON DELETE RESTRICT
);
CREATE INDEX "inventory_shop_quantity_idx" ON "inventory_balances"("shopId","quantity");

CREATE TABLE "stock_movements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT, "productId" UUID NOT NULL,
  "type" "StockMovementType" NOT NULL, "quantityChange" DECIMAL(18,3) NOT NULL CHECK ("quantityChange" <> 0),
  "quantityBefore" DECIMAL(18,3) NOT NULL CHECK ("quantityBefore" >= 0), "quantityAfter" DECIMAL(18,3) NOT NULL CHECK ("quantityAfter" >= 0),
  "unitCost" DECIMAL(18,2) CHECK ("unitCost" >= 0), "reason" VARCHAR(50), "note" VARCHAR(500),
  "idempotencyKey" VARCHAR(120), "payloadHash" CHAR(64), "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("productId","shopId") REFERENCES "products"("id","shopId") ON DELETE RESTRICT, UNIQUE ("shopId","idempotencyKey")
);
CREATE INDEX "stock_movements_shop_product_created_idx" ON "stock_movements"("shopId","productId","createdAt" DESC);
