ALTER TYPE "DebtEntryType" ADD VALUE IF NOT EXISTS 'CREDIT_SALE';
ALTER TYPE "DebtEntryType" ADD VALUE IF NOT EXISTS 'SALE_RETURN';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SALE';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SALE_RETURN';

CREATE TYPE "SalePaymentStatus" AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID');
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED', 'VOIDED');

ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_shop_unique" UNIQUE ("productId", "shopId");

CREATE TABLE "sale_counters" (
  "shopId" UUID PRIMARY KEY REFERENCES "shops"("id") ON DELETE RESTRICT,
  "nextValue" INTEGER NOT NULL DEFAULT 1 CHECK ("nextValue" > 0),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "sales" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "customerId" UUID,
  "saleNumber" VARCHAR(30) NOT NULL,
  "subtotal" DECIMAL(18,2) NOT NULL CHECK ("subtotal" >= 0),
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK ("discountAmount" >= 0),
  "totalAmount" DECIMAL(18,2) NOT NULL CHECK ("totalAmount" >= 0),
  "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK ("paidAmount" >= 0),
  "paymentStatus" "SalePaymentStatus" NOT NULL,
  "paymentMethod" "PaymentMethod",
  "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
  "notes" VARCHAR(500),
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "voidedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "voidedAt" TIMESTAMPTZ(3),
  "voidReason" VARCHAR(500),
  "voidIdempotencyKey" VARCHAR(120),
  "voidPayloadHash" CHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_amounts_valid" CHECK ("totalAmount" = "subtotal" - "discountAmount" AND "paidAmount" <= "totalAmount"),
  UNIQUE ("id", "shopId"),
  UNIQUE ("shopId", "saleNumber"),
  UNIQUE ("shopId", "idempotencyKey"),
  UNIQUE ("shopId", "voidIdempotencyKey"),
  FOREIGN KEY ("customerId", "shopId") REFERENCES "customers"("id", "shopId") ON DELETE RESTRICT
);

CREATE TABLE "sale_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "productNameSnapshot" VARCHAR(200) NOT NULL,
  "unitSnapshot" VARCHAR(30) NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL CHECK ("quantity" > 0),
  "unitPrice" DECIMAL(18,2) NOT NULL CHECK ("unitPrice" >= 0),
  "unitCostSnapshot" DECIMAL(18,2) CHECK ("unitCostSnapshot" >= 0),
  "lineSubtotal" DECIMAL(18,2) NOT NULL CHECK ("lineSubtotal" >= 0),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("id", "shopId"),
  FOREIGN KEY ("saleId", "shopId") REFERENCES "sales"("id", "shopId") ON DELETE RESTRICT,
  FOREIGN KEY ("productId", "shopId") REFERENCES "products"("id", "shopId") ON DELETE RESTRICT
);

CREATE TABLE "sale_returns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "saleId" UUID NOT NULL,
  "returnNumber" INTEGER NOT NULL CHECK ("returnNumber" > 0),
  "totalAmount" DECIMAL(18,2) NOT NULL CHECK ("totalAmount" >= 0),
  "debtReductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK ("debtReductionAmount" >= 0),
  "refundAmount" DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK ("refundAmount" >= 0),
  "refundMethod" "PaymentMethod",
  "reason" VARCHAR(500),
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_returns_financial_total" CHECK ("totalAmount" = "debtReductionAmount" + "refundAmount"),
  UNIQUE ("id", "shopId"),
  UNIQUE ("shopId", "idempotencyKey"),
  UNIQUE ("saleId", "returnNumber"),
  FOREIGN KEY ("saleId", "shopId") REFERENCES "sales"("id", "shopId") ON DELETE RESTRICT
);

CREATE TABLE "sale_return_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "saleReturnId" UUID NOT NULL,
  "saleItemId" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL CHECK ("quantity" > 0),
  "unitRefundAmount" DECIMAL(18,2) NOT NULL CHECK ("unitRefundAmount" >= 0),
  "lineRefundAmount" DECIMAL(18,2) NOT NULL CHECK ("lineRefundAmount" >= 0),
  "restock" BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY ("saleReturnId", "shopId") REFERENCES "sale_returns"("id", "shopId") ON DELETE RESTRICT,
  FOREIGN KEY ("saleItemId", "shopId") REFERENCES "sale_items"("id", "shopId") ON DELETE RESTRICT
);

ALTER TABLE "payments" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "saleId" UUID REFERENCES "sales"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_entries" ADD COLUMN "saleId" UUID REFERENCES "sales"("id") ON DELETE RESTRICT;
ALTER TABLE "stock_movements" ADD COLUMN "saleId" UUID REFERENCES "sales"("id") ON DELETE RESTRICT;
ALTER TABLE "stock_movements" ADD COLUMN "saleReturnId" UUID REFERENCES "sale_returns"("id") ON DELETE RESTRICT;

CREATE INDEX "sales_shop_created_idx" ON "sales"("shopId", "createdAt" DESC);
CREATE INDEX "sales_shop_customer_created_idx" ON "sales"("shopId", "customerId", "createdAt" DESC);
CREATE INDEX "sale_items_sale_idx" ON "sale_items"("saleId");
CREATE INDEX "sale_items_shop_product_idx" ON "sale_items"("shopId", "productId");
CREATE INDEX "sale_returns_shop_sale_created_idx" ON "sale_returns"("shopId", "saleId", "createdAt" DESC);
CREATE INDEX "sale_return_items_return_idx" ON "sale_return_items"("saleReturnId");
CREATE INDEX "sale_return_items_item_idx" ON "sale_return_items"("saleItemId");
CREATE INDEX "payments_shop_sale_idx" ON "payments"("shopId", "saleId");
CREATE INDEX "debt_entries_shop_sale_idx" ON "debt_entries"("shopId", "saleId");
CREATE INDEX "stock_movements_shop_sale_idx" ON "stock_movements"("shopId", "saleId");
CREATE INDEX "stock_movements_shop_return_idx" ON "stock_movements"("shopId", "saleReturnId");
