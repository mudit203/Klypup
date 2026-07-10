-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "CompetitorPriceEvent" AS ENUM ('NO_CHANGE', 'SMALL_FLUCTUATION', 'PRICE_DROP', 'PRICE_INCREASE', 'NEW_COMPETITOR');

-- CreateEnum
CREATE TYPE "DemandTrend" AS ENUM ('RISING', 'STABLE', 'FALLING', 'SEASONAL_PEAK', 'SEASONAL_DIP');

-- CreateEnum
CREATE TYPE "PriceChangeSource" AS ENUM ('AI_AUTO_EXECUTED', 'ANALYST_APPROVED', 'ANALYST_MODIFIED', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'AUTO_EXECUTED', 'APPROVED', 'MODIFIED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationTrigger" AS ENUM ('MANUAL', 'MARKET_SIMULATION', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('MARKET_INTELLIGENCE', 'DEMAND_FORECASTING', 'INVENTORY_COST', 'PRICING_STRATEGY', 'EXECUTION_COMPLIANCE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PRICE_AUTO_EXECUTED', 'PRICE_APPROVED', 'PRICE_MODIFIED', 'PRICE_REJECTED', 'PRICE_ADMIN_MANUAL', 'ANALYSIS_TRIGGERED', 'ANALYSIS_FAILED', 'SIMULATION_RUN', 'STORE_UPDATE_FAILED', 'USER_INVITED', 'USER_ROLE_CHANGED', 'SETTINGS_UPDATED');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarginFloor" (
    "id" TEXT NOT NULL,
    "org_settings_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "min_margin" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MarginFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ANALYST',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cost_of_goods" DOUBLE PRECISION NOT NULL,
    "current_price" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPrice" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "competitor" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "event_type" "CompetitorPriceEvent" NOT NULL DEFAULT 'NO_CHANGE',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandSignal" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "demand_index" DOUBLE PRECISION NOT NULL,
    "trend" "DemandTrend" NOT NULL,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "stock_level" INTEGER NOT NULL,
    "restock_event" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "old_price" DOUBLE PRECISION NOT NULL,
    "new_price" DOUBLE PRECISION NOT NULL,
    "change_source" "PriceChangeSource" NOT NULL,
    "recommendation_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "current_price" DOUBLE PRECISION NOT NULL,
    "recommended_price" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "RecommendationTrigger" NOT NULL,
    "rationale" TEXT NOT NULL,
    "analyst_note" TEXT,
    "final_price" DOUBLE PRECISION,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "store_update_ok" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentOutput" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "agent_name" "AgentName" NOT NULL,
    "summary" TEXT NOT NULL,
    "data_used" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "run_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT,
    "recommendation_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "old_price" DOUBLE PRECISION,
    "new_price" DOUBLE PRECISION,
    "product_id" TEXT,
    "product_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_org_id_key" ON "OrgSettings"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_org_id_idx" ON "User"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_hash_key" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE INDEX "Product_org_id_idx" ON "Product"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_org_id_sku_key" ON "Product"("org_id", "sku");

-- CreateIndex
CREATE INDEX "CompetitorPrice_product_id_recorded_at_idx" ON "CompetitorPrice"("product_id", "recorded_at");

-- CreateIndex
CREATE INDEX "DemandSignal_product_id_recorded_at_idx" ON "DemandSignal"("product_id", "recorded_at");

-- CreateIndex
CREATE INDEX "InventorySnapshot_product_id_recorded_at_idx" ON "InventorySnapshot"("product_id", "recorded_at");

-- CreateIndex
CREATE INDEX "PriceHistory_product_id_changed_at_idx" ON "PriceHistory"("product_id", "changed_at");

-- CreateIndex
CREATE INDEX "Recommendation_product_id_status_idx" ON "Recommendation"("product_id", "status");

-- CreateIndex
CREATE INDEX "AuditLog_org_id_created_at_idx" ON "AuditLog"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_product_id_idx" ON "AuditLog"("product_id");

-- AddForeignKey
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginFloor" ADD CONSTRAINT "MarginFloor_org_settings_id_fkey" FOREIGN KEY ("org_settings_id") REFERENCES "OrgSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSignal" ADD CONSTRAINT "DemandSignal_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOutput" ADD CONSTRAINT "AgentOutput_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
