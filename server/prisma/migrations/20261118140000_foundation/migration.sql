CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "PlatformRole" AS ENUM ('ADMIN', 'OWNER');
CREATE TYPE "ShopAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "MembershipRole" AS ENUM ('OWNER');
CREATE TYPE "SubscriptionType" AS ENUM ('TRIAL', 'PAID');
CREATE TYPE "DurationUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');
CREATE TYPE "SubscriptionRecordStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED');
CREATE TYPE "SubscriptionEventType" AS ENUM ('ACTIVATED', 'TRIAL_STARTED', 'RENEWED', 'EXTENDED', 'CANCELLED', 'CORRECTED');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName" VARCHAR(120) NOT NULL,
  "phoneNumber" VARCHAR(20) NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "platformRole" "PlatformRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE,
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "lastLoginAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "shops" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "phoneNumber" VARCHAR(20) NOT NULL UNIQUE,
  "currencyCode" CHAR(3) NOT NULL DEFAULT 'USD',
  "accountStatus" "ShopAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "shop_memberships" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "role" "MembershipRole" NOT NULL DEFAULT 'OWNER',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("shopId", "userId")
);

CREATE TABLE "subscription_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(40) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "type" "SubscriptionType" NOT NULL,
  "durationUnit" "DurationUnit" NOT NULL,
  "durationCount" INTEGER NOT NULL CHECK ("durationCount" > 0),
  "price" DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK ("price" >= 0),
  "currencyCode" CHAR(3) NOT NULL DEFAULT 'USD',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "shop_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL UNIQUE REFERENCES "shops"("id") ON DELETE RESTRICT,
  "planId" UUID NOT NULL REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "SubscriptionRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "snapshotPlanCode" VARCHAR(40) NOT NULL,
  "snapshotPrice" DECIMAL(18,2) NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("expiresAt" > "startsAt")
);

CREATE TABLE "subscription_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL REFERENCES "shops"("id") ON DELETE RESTRICT,
  "subscriptionId" UUID NOT NULL REFERENCES "shop_subscriptions"("id") ON DELETE RESTRICT,
  "eventType" "SubscriptionEventType" NOT NULL,
  "previousExpiresAt" TIMESTAMPTZ(3),
  "newExpiresAt" TIMESTAMPTZ(3),
  "performedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "idempotencyKey" VARCHAR(120),
  "note" VARCHAR(500),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("shopId", "idempotencyKey")
);

CREATE TABLE "refresh_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "familyId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "replacedBy" UUID,
  "userAgent" VARCHAR(300),
  "ipAddress" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "admin_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "shopId" UUID REFERENCES "shops"("id") ON DELETE RESTRICT,
  "action" VARCHAR(80) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" VARCHAR(80) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "users_role_active_idx" ON "users" ("platformRole", "isActive");
CREATE INDEX "shops_status_created_idx" ON "shops" ("accountStatus", "createdAt" DESC);
CREATE INDEX "shops_name_idx" ON "shops" (LOWER("name"));
CREATE INDEX "memberships_user_active_idx" ON "shop_memberships" ("userId", "isActive");
CREATE INDEX "memberships_shop_active_idx" ON "shop_memberships" ("shopId", "isActive");
CREATE UNIQUE INDEX "one_active_owner_per_shop" ON "shop_memberships" ("shopId") WHERE "role" = 'OWNER' AND "isActive" = TRUE;
CREATE INDEX "plans_active_type_idx" ON "subscription_plans" ("isActive", "type");
CREATE INDEX "subscriptions_status_expiry_idx" ON "shop_subscriptions" ("status", "expiresAt");
CREATE INDEX "subscriptions_plan_status_idx" ON "shop_subscriptions" ("planId", "status");
CREATE INDEX "events_shop_created_idx" ON "subscription_events" ("shopId", "createdAt" DESC);
CREATE INDEX "events_subscription_created_idx" ON "subscription_events" ("subscriptionId", "createdAt" DESC);
CREATE INDEX "sessions_user_expiry_idx" ON "refresh_sessions" ("userId", "expiresAt");
CREATE INDEX "sessions_family_revoked_idx" ON "refresh_sessions" ("familyId", "revokedAt");
CREATE INDEX "audit_shop_created_idx" ON "admin_audit_logs" ("shopId", "createdAt" DESC);
CREATE INDEX "audit_actor_created_idx" ON "admin_audit_logs" ("actorUserId", "createdAt" DESC);
CREATE INDEX "audit_entity_idx" ON "admin_audit_logs" ("entityType", "entityId");
