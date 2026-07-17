# Technical Specification — Klypup Dynamic Pricing Intelligence Dashboard

> **Derived from:** `PROJECT_BASE_DOCUMENT.md`
> **Stack:** Next.js (App Router, TypeScript) · Express.js (TypeScript) · PostgreSQL via Supabase · Prisma ORM · JWT Auth · Groq AI · Docker Compose · Tailwind CSS + shadcn/ui · Recharts · Zod

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack Reference](#2-tech-stack-reference)
3. [Repository Structure](#3-repository-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Backend — Express.js API](#6-backend--expressjs-api)
7. [AI Agent System](#7-ai-agent-system)
8. [Market Simulation Engine](#8-market-simulation-engine)
9. [Frontend — Next.js App Router](#9-frontend--nextjs-app-router)
10. [Shared Validation (Zod)](#10-shared-validation-zod)
11. [Seed Data & Demo Scenarios](#11-seed-data--demo-scenarios)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Docker Compose Setup](#13-docker-compose-setup)
14. [Environment Variables](#14-environment-variables)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. System Overview

Klypup is a multi-tenant SaaS web application for e-commerce pricing teams. It monitors simulated market conditions and uses a five-agent AI pipeline (powered by Groq) to generate, score, and (conditionally) auto-execute pricing recommendations. A human approval workflow handles low-confidence recommendations, and every price decision is persisted in a full audit trail.

### High-Level Architecture

The system is split into three layers:

- **Browser (Next.js):** Dashboard, Product Detail, Approval Queue, Audit Trail, Admin Settings — all communicating with the backend via REST (axios).
- **Express.js API Server (TypeScript):** JWT Middleware → Tenant Scope Middleware → Role Middleware → Route Controllers → Services. Also hosts the AI Orchestrator and the node-cron Scheduler.
- **PostgreSQL (Supabase) via Prisma ORM:** Stores all business data — orgs, users, products, competitor prices, demand signals, inventory snapshots, recommendations, agent outputs, audit logs, price history, and org settings.

### Multi-Tenancy Model

- Every database table that stores business data carries an `org_id` foreign key (FK → `orgs.id`).
- Tenant isolation is enforced via a **dedicated Express middleware** (`tenantScope.ts`) that extracts `org_id` from the verified JWT and injects it into `req.orgId`.
- Every Prisma query in route handlers uses `where: { org_id: req.orgId }` — no exceptions.
- A malicious user cannot access another org's data even with a valid UUID, because the middleware scopes every query.

---

## 2. Tech Stack Reference

| Layer | Technology | Notes |
|---|---|---|
| Frontend Framework | Next.js 14+ (App Router) | TypeScript, Server + Client Components |
| Styling | Tailwind CSS + shadcn/ui | Component library built on Radix UI |
| Charts | Recharts | Price history & competitor price charts |
| HTTP Client | axios | With interceptors for JWT refresh |
| State Management | React state (useState, useReducer, Context) | No TanStack Query — plain fetch/axios |
| Backend Framework | Express.js | TypeScript, compiled via tsc or ts-node |
| Database | PostgreSQL (Supabase) | Cloud-hosted, accessed via connection string |
| ORM | Prisma | Schema, migrations, typed queries |
| Auth | JWT (access + refresh) + bcrypt | jsonwebtoken, bcryptjs |
| AI | Groq API | groq-sdk, five specialized agent modules |
| Validation | Zod | Shared schemas in /shared |
| Scheduling | node-cron | Market simulation cron jobs |
| Containerization | Docker Compose | One-command local startup |
| Environment | .env files | Documented via .env.example |

---

## 3. Repository Structure

```
klypup/
├── docker-compose.yml
├── .env.example
├── .env                          # gitignored
├── PROJECT_BASE_DOCUMENT.md
├── TECHNICAL_SPEC.md
│
├── frontend/                     # Next.js app
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── public/
│   └── src/
│       ├── app/                  # App Router pages
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── signup/page.tsx
│       │   └── (dashboard)/
│       │       ├── layout.tsx
│       │       ├── page.tsx                   # Dashboard Home
│       │       ├── products/[id]/page.tsx     # Product Detail
│       │       ├── approval-queue/page.tsx
│       │       ├── audit/page.tsx
│       │       └── admin/
│       │           ├── page.tsx               # Settings Panel
│       │           └── users/page.tsx         # Org User Management
│       ├── components/
│       │   ├── ui/               # shadcn/ui generated components
│       │   ├── layout/           # Sidebar, Header, etc.
│       │   ├── products/         # ProductTable, ProductCard, etc.
│       │   ├── recommendations/  # AgentOutputCard, RecommendationPanel
│       │   ├── charts/           # PriceHistoryChart, CompetitorChart
│       │   ├── audit/            # AuditLogTable
│       │   └── admin/            # SettingsForm, UserManagement
│       ├── lib/
│       │   ├── api.ts            # axios instance + interceptors
│       │   ├── auth.ts           # Token storage helpers
│       │   └── utils.ts
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   └── useProducts.ts
│       ├── context/
│       │   └── AuthContext.tsx
│       └── types/                # Frontend TypeScript types
│
├── backend/                      # Express.js API
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.ts              # Server entry point
│       ├── config/
│       │   └── env.ts
│       ├── middleware/
│       │   ├── authenticate.ts   # JWT verification
│       │   ├── tenantScope.ts    # org_id injection
│       │   └── requireRole.ts    # Role-based access
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── products.routes.ts
│       │   ├── recommendations.routes.ts
│       │   ├── audit.routes.ts
│       │   ├── admin.routes.ts
│       │   ├── simulation.routes.ts
│       │   └── ai-analysis.routes.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── products.controller.ts
│       │   ├── recommendations.controller.ts
│       │   ├── audit.controller.ts
│       │   ├── admin.controller.ts
│       │   ├── simulation.controller.ts
│       │   └── ai-analysis.controller.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── products.service.ts
│       │   ├── recommendations.service.ts
│       │   ├── audit.service.ts
│       │   ├── admin.service.ts
│       │   └── simulation.service.ts
│       ├── agents/               # AI agent modules
│       │   ├── orchestrator.ts
│       │   ├── marketIntelligence.agent.ts
│       │   ├── demandForecasting.agent.ts
│       │   ├── inventoryCost.agent.ts
│       │   ├── pricingStrategy.agent.ts
│       │   └── executionCompliance.agent.ts
│       ├── scheduler/
│       │   └── marketSimulation.cron.ts
│       └── lib/
│           ├── prisma.ts
│           ├── groq.ts
│           └── mockStore.ts
│
└── shared/                       # Shared Zod schemas & TypeScript types
    ├── package.json
    └── src/
        ├── schemas/
        │   ├── auth.schema.ts
        │   ├── product.schema.ts
        │   ├── recommendation.schema.ts
        │   └── admin.schema.ts
        └── types/
            └── index.ts
```

---

## 4. Database Schema

> All tables that store business data include `org_id` (FK to `orgs.id`). Prisma enforces referential integrity; child records cascade-delete when the parent org is deleted.

### 4.1 Entity Overview

| Model | Purpose |
|---|---|
| Org | Top-level tenant entity |
| OrgSettings | Per-org config: confidence threshold |
| MarginFloor | Minimum margin per product category per org |
| User | Belongs to one org, has one role (ADMIN or ANALYST) |
| RefreshToken | Hashed refresh tokens for secure rotation |
| Product | Product catalog item belonging to one org |
| CompetitorPrice | Time-series competitor prices per product |
| DemandSignal | Time-series demand/interest signals per product |
| InventorySnapshot | Time-series stock levels per product |
| PriceHistory | Immutable append-only log of every price change |
| Recommendation | AI-generated pricing recommendation |
| AgentOutput | Output from each of the 5 agents per Recommendation |
| AuditLog | Immutable org-scoped audit trail |

### 4.2 Key Enums

- **Role:** ADMIN | ANALYST
- **CompetitorPriceEvent:** NO_CHANGE | SMALL_FLUCTUATION | PRICE_DROP | PRICE_INCREASE | NEW_COMPETITOR
- **DemandTrend:** RISING | STABLE | FALLING | SEASONAL_PEAK | SEASONAL_DIP
- **PriceChangeSource:** AI_AUTO_EXECUTED | ANALYST_APPROVED | ANALYST_MODIFIED | ADMIN_MANUAL
- **RecommendationStatus:** PENDING | AUTO_EXECUTED | APPROVED | MODIFIED | REJECTED | FAILED
- **RecommendationTrigger:** MANUAL | MARKET_SIMULATION | SCHEDULED
- **AgentName:** MARKET_INTELLIGENCE | DEMAND_FORECASTING | INVENTORY_COST | PRICING_STRATEGY | EXECUTION_COMPLIANCE
- **AuditAction:** PRICE_AUTO_EXECUTED | PRICE_APPROVED | PRICE_MODIFIED | PRICE_REJECTED | PRICE_ADMIN_MANUAL | ANALYSIS_TRIGGERED | ANALYSIS_FAILED | SIMULATION_RUN | STORE_UPDATE_FAILED | USER_INVITED | USER_ROLE_CHANGED | SETTINGS_UPDATED

### 4.3 Prisma Schema (backend/prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Org {
  id         String       @id @default(uuid())
  name       String
  created_at DateTime     @default(now())
  users      User[]
  settings   OrgSettings?
  products   Product[]
  audit_logs AuditLog[]
}

model OrgSettings {
  id                   String        @id @default(uuid())
  org_id               String        @unique
  org                  Org           @relation(fields: [org_id], references: [id], onDelete: Cascade)
  confidence_threshold Float         @default(0.80)
  created_at           DateTime      @default(now())
  updated_at           DateTime      @updatedAt
  margin_floors        MarginFloor[]
}

model MarginFloor {
  id              String      @id @default(uuid())
  org_settings_id String
  org_settings    OrgSettings @relation(fields: [org_settings_id], references: [id], onDelete: Cascade)
  category        String
  min_margin      Float
}

model User {
  id             String         @id @default(uuid())
  org_id         String
  org            Org            @relation(fields: [org_id], references: [id], onDelete: Cascade)
  email          String         @unique
  password_hash  String
  name           String
  role           Role           @default(ANALYST)
  created_at     DateTime       @default(now())
  refresh_tokens RefreshToken[]
  audit_logs     AuditLog[]
  @@index([org_id])
}

enum Role {
  ADMIN
  ANALYST
}

model RefreshToken {
  id         String   @id @default(uuid())
  user_id    String
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  token_hash String   @unique
  expires_at DateTime
  revoked    Boolean  @default(false)
  created_at DateTime @default(now())
}

model Product {
  id                  String              @id @default(uuid())
  org_id              String
  org                 Org                 @relation(fields: [org_id], references: [id], onDelete: Cascade)
  name                String
  sku                 String
  category            String
  cost_of_goods       Float
  current_price       Float
  is_active           Boolean             @default(true)
  created_at          DateTime            @default(now())
  updated_at          DateTime            @updatedAt
  competitor_prices   CompetitorPrice[]
  demand_signals      DemandSignal[]
  inventory_snapshots InventorySnapshot[]
  price_history       PriceHistory[]
  recommendations     Recommendation[]
  @@unique([org_id, sku])
  @@index([org_id])
}

model CompetitorPrice {
  id          String               @id @default(uuid())
  product_id  String
  product     Product              @relation(fields: [product_id], references: [id], onDelete: Cascade)
  competitor  String
  price       Float
  event_type  CompetitorPriceEvent @default(NO_CHANGE)
  recorded_at DateTime             @default(now())
  @@index([product_id, recorded_at])
}

enum CompetitorPriceEvent {
  NO_CHANGE
  SMALL_FLUCTUATION
  PRICE_DROP
  PRICE_INCREASE
  NEW_COMPETITOR
}

model DemandSignal {
  id           String      @id @default(uuid())
  product_id   String
  product      Product     @relation(fields: [product_id], references: [id], onDelete: Cascade)
  demand_index Float
  trend        DemandTrend
  notes        String?
  recorded_at  DateTime    @default(now())
  @@index([product_id, recorded_at])
}

enum DemandTrend {
  RISING
  STABLE
  FALLING
  SEASONAL_PEAK
  SEASONAL_DIP
}

model InventorySnapshot {
  id            String   @id @default(uuid())
  product_id    String
  product       Product  @relation(fields: [product_id], references: [id], onDelete: Cascade)
  stock_level   Int
  restock_event Boolean  @default(false)
  recorded_at   DateTime @default(now())
  @@index([product_id, recorded_at])
}

model PriceHistory {
  id                String            @id @default(uuid())
  product_id        String
  product           Product           @relation(fields: [product_id], references: [id], onDelete: Cascade)
  old_price         Float
  new_price         Float
  change_source     PriceChangeSource
  recommendation_id String?
  recommendation    Recommendation?   @relation(fields: [recommendation_id], references: [id])
  changed_at        DateTime          @default(now())
  @@index([product_id, changed_at])
}

enum PriceChangeSource {
  AI_AUTO_EXECUTED
  ANALYST_APPROVED
  ANALYST_MODIFIED
  ADMIN_MANUAL
}

model Recommendation {
  id                String               @id @default(uuid())
  product_id        String
  product           Product              @relation(fields: [product_id], references: [id], onDelete: Cascade)
  current_price     Float
  recommended_price Float
  confidence_score  Float
  status            RecommendationStatus @default(PENDING)
  trigger           RecommendationTrigger
  rationale         String
  analyst_note      String?
  final_price       Float?
  reviewed_by       String?
  reviewed_at       DateTime?
  store_update_ok   Boolean?
  created_at        DateTime             @default(now())
  updated_at        DateTime             @updatedAt
  agent_outputs     AgentOutput[]
  price_history     PriceHistory[]
  audit_logs        AuditLog[]
  @@index([product_id, status])
}

enum RecommendationStatus {
  PENDING
  AUTO_EXECUTED
  APPROVED
  MODIFIED
  REJECTED
  FAILED
}

enum RecommendationTrigger {
  MANUAL
  MARKET_SIMULATION
  SCHEDULED
}

model AgentOutput {
  id                String         @id @default(uuid())
  recommendation_id String
  recommendation    Recommendation @relation(fields: [recommendation_id], references: [id], onDelete: Cascade)
  agent_name        AgentName
  summary           String
  data_used         Json
  output            Json
  run_order         Int
  created_at        DateTime       @default(now())
}

enum AgentName {
  MARKET_INTELLIGENCE
  DEMAND_FORECASTING
  INVENTORY_COST
  PRICING_STRATEGY
  EXECUTION_COMPLIANCE
}

model AuditLog {
  id                String          @id @default(uuid())
  org_id            String
  org               Org             @relation(fields: [org_id], references: [id], onDelete: Cascade)
  user_id           String?
  user              User?           @relation(fields: [user_id], references: [id])
  recommendation_id String?
  recommendation    Recommendation? @relation(fields: [recommendation_id], references: [id])
  action            AuditAction
  old_price         Float?
  new_price         Float?
  product_id        String?
  product_name      String?
  notes             String?
  created_at        DateTime        @default(now())
  @@index([org_id, created_at])
  @@index([product_id])
}

enum AuditAction {
  PRICE_AUTO_EXECUTED
  PRICE_APPROVED
  PRICE_MODIFIED
  PRICE_REJECTED
  PRICE_ADMIN_MANUAL
  ANALYSIS_TRIGGERED
  ANALYSIS_FAILED
  SIMULATION_RUN
  STORE_UPDATE_FAILED
  USER_INVITED
  USER_ROLE_CHANGED
  SETTINGS_UPDATED
}
```

### 4.4 Critical Design Decisions

- **Soft deletes for products:** `is_active = false` instead of hard delete, preserving audit history.
- **Denormalized `product_name` in AuditLog:** Preserved for display even after a product is deleted.
- **PriceHistory is append-only:** No updates, only inserts. Price changes are never overwritten.
- **AgentOutput.data_used (Json):** Stores a snapshot of the raw data analyzed at time of run, making reasoning reproducible even if underlying data later changes.
- **RefreshToken stores a bcrypt hash, not the raw token:** DB compromise cannot yield replayable tokens.

---

## 5. Authentication & Authorization

### 5.1 Auth Flow

```
POST /auth/signup  -> create Org + User + OrgSettings -> return { accessToken, refreshToken }
POST /auth/login   -> verify password -> return { accessToken, refreshToken }
POST /auth/refresh -> verify refreshToken hash in DB -> return new { accessToken, refreshToken }
POST /auth/logout  -> mark refreshToken as revoked in DB
```

### 5.2 Token Design

| Token | Algorithm | Payload | Expiry |
|---|---|---|---|
| Access Token | HS256 (JWT) | { sub: userId, orgId, role, iat, exp } | 15 minutes |
| Refresh Token | HS256 (JWT) | { sub: userId, jti: uuid, iat, exp } | 7 days |

- Access token is sent in every request as `Authorization: Bearer <token>`.
- Refresh token is stored as a bcrypt hash in the RefreshToken table.
- Token rotation: on refresh, old token is revoked; new pair is issued.

### 5.3 Middleware Stack

Applied in this order on every protected route:

1. **authenticate.ts** — verifies JWT signature and expiry; attaches `req.user = { userId, orgId, role }`.
2. **tenantScope.ts** — sets `req.orgId = req.user.orgId`. All downstream Prisma queries use this.
3. **requireRole.ts** — factory: `requireRole('ADMIN')` throws 403 if user.role !== 'ADMIN'.

### 5.4 Password Storage

- `bcryptjs` with salt rounds = 12.
- Passwords are **never** returned in any API response (excluded from all Prisma selects).

---

## 6. Backend — Express.js API

### 6.1 Global Middleware

```typescript
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(helmet())
app.use(morgan('dev'))
```

### 6.2 Complete Route Map (prefix: /api/v1)

#### Auth — /auth

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | /auth/signup | None | — | Create org + admin user |
| POST | /auth/login | None | — | Login, return tokens |
| POST | /auth/refresh | None | — | Refresh access token |
| POST | /auth/logout | JWT | Any | Revoke refresh token |
| GET | /auth/me | JWT | Any | Current user info |

#### Products — /products

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | /products | JWT | Any | List (?search, ?category, ?status, ?sort, ?page, ?limit) |
| GET | /products/:id | JWT | Any | Single product with latest market data |
| POST | /products | JWT | Admin | Create |
| PATCH | /products/:id | JWT | Admin | Update |
| DELETE | /products/:id | JWT | Admin | Soft-delete |
| GET | /products/:id/price-history | JWT | Any | Full price history |
| GET | /products/:id/competitor-prices | JWT | Any | Competitor price history |
| GET | /products/:id/demand-signals | JWT | Any | Demand signal history |

#### AI Analysis — /ai-analysis

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | /ai-analysis/:productId/run | JWT | Any | Trigger 5-agent analysis |
| GET | /ai-analysis/:productId/latest | JWT | Any | Latest recommendation |

#### Recommendations — /recommendations

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | /recommendations | JWT | Any | List (?status, sorted by confidence) |
| GET | /recommendations/:id | JWT | Any | Detail with all agent outputs |
| POST | /recommendations/:id/approve | JWT | Analyst | Approve |
| POST | /recommendations/:id/modify | JWT | Analyst | Modify price and approve |
| POST | /recommendations/:id/reject | JWT | Analyst | Reject with reason |

#### Audit — /audit

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | /audit | JWT | Any | Audit log (?product_id, ?action, ?from, ?to, ?page, ?limit) |

#### Admin — /admin

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | /admin/settings | JWT | Admin | Org settings + margin floors |
| PATCH | /admin/settings | JWT | Admin | Update confidence threshold |
| POST | /admin/settings/margin-floors | JWT | Admin | Add margin floor |
| DELETE | /admin/settings/margin-floors/:id | JWT | Admin | Remove margin floor |
| GET | /admin/users | JWT | Admin | List org users |
| POST | /admin/users/invite | JWT | Admin | Add user to org |
| PATCH | /admin/users/:id/role | JWT | Admin | Change user role |
| DELETE | /admin/users/:id | JWT | Admin | Remove user |

#### Simulation — /simulation

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | /simulation/run | JWT | Admin | Manual simulation trigger |
| GET | /simulation/status | JWT | Any | Last simulation info |

#### Mock Store — /mock-store (internal)

| Method | Path | Description |
|---|---|---|
| POST | /mock-store/update-price | 20% random failure rate |

---

## 7. AI Agent System

### 7.1 Orchestrator Design

The orchestrator runs agents **sequentially** in order 1→5. Each agent receives outputs of all previous agents plus raw product/market data. Each AgentOutput is persisted to the DB immediately after completion — not in a batch — so partial results are visible if a later agent fails.

**Execution sequence:**

1. Fetch product + last 30 days of competitor prices, demand signals, inventory snapshots, org settings, margin floors.
2. Create shell Recommendation (status = PENDING, trigger = MANUAL|MARKET_SIMULATION|SCHEDULED).
3. Run Agent 1 → persist AgentOutput (run_order=1) → append to context.previousOutputs.
4. Run Agent 2 → persist AgentOutput (run_order=2) → append to context.previousOutputs.
5. Run Agent 3 → persist AgentOutput (run_order=3) → append to context.previousOutputs.
6. Run Agent 4 → persist AgentOutput (run_order=4). Produces recommended_price + confidence_score.
7. Run Agent 5 → persist AgentOutput (run_order=5). Makes AUTO_EXECUTE / QUEUE_FOR_REVIEW / BLOCK decision.
8. Update Recommendation with final values.
9. If AUTO_EXECUTE: call mockStore.updateStorePrice(). If store fails → status = FAILED.
10. Create AuditLog for final outcome.

### 7.2 Agent Specifications

#### Agent 1 — Market Intelligence Agent (MARKET_INTELLIGENCE)

- **Input:** Last 30 days of CompetitorPrice records (competitor, price, event_type, recorded_at).
- **Groq call:** Yes — analyze competitor price movements, identify notable events.
- **Output schema:**
  - summary: string — plain English paragraph
  - notable_event: boolean
  - competitor_trend: "DOWN" | "UP" | "STABLE" | "MIXED"
  - biggest_competitor: string
  - biggest_price_delta_pct: number

#### Agent 2 — Demand Forecasting Agent (DEMAND_FORECASTING)

- **Input:** Last 30 days of DemandSignal records + product category.
- **Groq call:** Yes — analyze demand trend and seasonality.
- **Output schema:**
  - summary: string
  - demand_direction: "UP" | "DOWN" | "STABLE"
  - seasonality_factor: "PEAK" | "DIP" | "NEUTRAL"
  - pricing_implication: "INCREASE" | "DECREASE" | "HOLD"

#### Agent 3 — Inventory & Cost Agent (INVENTORY_COST)

- **Input:** Latest InventorySnapshot + Product.cost_of_goods + MarginFloor for category.
- **Groq call:** Optional (can compute deterministically; use Groq for narrative summary).
- **Output schema:**
  - summary: string
  - stock_status: "LOW" (< 20 units) | "NORMAL" | "HIGH" (> 200 units)
  - current_margin_pct: number
  - margin_floor_pct: number
  - margin_floor_violated: boolean
  - pricing_implication: "INCREASE" | "DECREASE" | "HOLD"

#### Agent 4 — Pricing Strategy Agent (PRICING_STRATEGY)

- **Input:** Outputs from Agents 1-3 + current product price + org confidence threshold.
- **Groq call:** Yes — synthesize all signals, recommend price and confidence.
- **Output schema:**
  - summary: string
  - recommended_price: number
  - confidence_score: number (0–100)
  - rationale: string (2–4 plain-English sentences)
  - reasoning_factors: string[]

#### Agent 5 — Execution & Compliance Agent (EXECUTION_COMPLIANCE)

- **Input:** Agent 4 output + OrgSettings.confidence_threshold + Agent 3.margin_floor_violated.
- **Groq call:** No — fully deterministic.
- **Decision logic:**
  1. If margin_floor_violated → decision = "BLOCK" (status = FAILED)
  2. Else if confidence_score / 100 >= confidence_threshold → decision = "AUTO_EXECUTE"
  3. Else → decision = "QUEUE_FOR_REVIEW" (status = PENDING)
- **Output schema:**
  - summary: string
  - decision: "AUTO_EXECUTE" | "QUEUE_FOR_REVIEW" | "BLOCK"
  - decision_reason: string
  - margin_check_passed: boolean
  - confidence_check_passed: boolean

### 7.3 Groq Integration

```typescript
// backend/src/lib/groq.ts
import Groq from 'groq-sdk'

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function callGroqAgent(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const chat = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    model: process.env.GROQ_MODEL ?? 'llama3-8b-8192',
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })
  return chat.choices[0].message.content ?? '{}'
}
```

### 7.4 Error Resilience

If any agent throws (Groq timeout, network error, JSON parse failure):
1. Catch the error in the orchestrator's try/catch.
2. Record a partial AgentOutput with `{ error: true, message: "..." }` in the output JSON.
3. Update Recommendation.status = FAILED.
4. Create AuditLog with action = ANALYSIS_FAILED.
5. Return HTTP 500 with `{ error: "AI analysis failed", retryable: true }`.
6. The Express server does **not crash** — error is fully contained within the analysis flow.

---

## 8. Market Simulation Engine

### 8.1 Simulation Cycle ("Market Day")

For each active product in the org, one simulation cycle does:

**Step 1 — Competitor Price Update** (weighted random event):
- 50%: NO_CHANGE
- 20%: SMALL_FLUCTUATION (±3%)
- 15%: PRICE_DROP (-5% to -20%)
- 10%: PRICE_INCREASE (+5% to +15%)
- 5%: NEW_COMPETITOR (new competitor at ±10% of current price)

Inserts a new CompetitorPrice record. Old records are kept as history.

**Step 2 — Demand Signal Update:**
- Base demand modulated by category seasonality:
  - Electronics: peaks Q4, dips Q1–Q2
  - Clothing: peaks spring and fall
  - Home & Kitchen: stable with minor peaks
  - Sports & Outdoors: peaks spring/summer
- Add ±10% random noise.
- Insert a new DemandSignal record.

**Step 3 — Inventory Update:**
- units_sold = random number based on demand_index (higher demand = more sales).
- stock_level decremented by units_sold (floor at 0).
- 10% chance of restock event: add 100–500 units.
- Insert a new InventorySnapshot record.

**Step 4 — Trigger AI Analysis (optional):**
If `SIMULATION_TRIGGER_AI=true`, run full 5-agent analysis for each product.

### 8.2 Scheduling

```typescript
// backend/src/scheduler/marketSimulation.cron.ts
import cron from 'node-cron'
import { runSimulationCycle } from '../services/simulation.service'

cron.schedule(process.env.SIMULATION_CRON ?? '0 */6 * * *', async () => {
  await runSimulationCycle()
})
```

Manual trigger: `POST /simulation/run` (Admin only) calls the same runSimulationCycle() function.

### 8.3 Mock Store

```typescript
// backend/src/lib/mockStore.ts
export async function updateStorePrice(
  productId: string,
  newPrice: number
): Promise<{ success: boolean }> {
  if (Math.random() < 0.20) return { success: false }
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300))
  return { success: true }
}
```

On failure: Recommendation.status = FAILED, Product.current_price NOT updated, AuditLog with STORE_UPDATE_FAILED.

---

## 9. Frontend — Next.js App Router

### 9.1 Authentication State

```typescript
// frontend/src/context/AuthContext.tsx
interface AuthState {
  user: {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'ANALYST'
    orgId: string
  } | null
  accessToken: string | null  // in-memory only (XSS safe)
  isLoading: boolean
}
```

On app load: call POST /auth/refresh to restore session from HttpOnly cookie.
Axios interceptor: on 401, call refresh → retry original request.

### 9.2 Screen Specifications

#### Screen 1 — Login (/login) & Signup (/signup)

- Login: Email + Password. On success → store accessToken in context → redirect to /.
- Signup: Org Name + Full Name + Email + Password → creates org + admin user → auto login → redirect to /.
- Zod validation client-side before submit. Server-side on backend.

#### Screen 2 — Dashboard Home (/)

- Product catalog table columns: Name, SKU, Category, Current Price, Lowest Competitor Price, Margin %, Stock Status badge, Recommendation Status badge, Last Updated.
- Debounced text search (name/SKU). Category dropdown filter. Status filter. Sort by price/margin/confidence/date.
- Per-row "Run Analysis" button (loading state on that row while running).
- Admin-only "Simulate Market Day" button (global, top of page).
- States: loading skeleton (table rows), empty state with "Add Product" CTA, error banner with Retry.

#### Screen 3 — Product Detail (/products/[id])

- Header: name, SKU, category chip, current price badge, stock status badge (color coded: red=LOW, green=NORMAL, yellow=HIGH).
- Recharts LineChart: own price + competitor prices over 30 days. X=date, Y=price. Tooltip on hover.
- Recommendation Panel (if exists): confidence progress bar, recommended price vs current delta, status badge, 5-agent collapsible breakdown.
- If PENDING + role=ANALYST: Approve / Modify / Reject action buttons.
- Inventory & Demand panel: stock level, demand index gauge, trend arrow.
- States: loading skeleton per section, empty "Run Analysis" CTA, error.

#### Screen 4 — Approval Queue (/approval-queue)

- PENDING recommendations sorted by confidence_score descending.
- Columns: Product, Recommended Price, Current Price, Delta, Confidence (progress bar), Trigger, Age.
- Inline: Approve button, Modify button (opens modal: price input), Reject button (opens modal: reason input).
- Optimistic removal from list after action + success toast. Analyst-only.

#### Screen 5 — Audit Trail (/audit)

- Paginated table (25/page): Timestamp, Action badge, Product, Old Price → New Price, Actor, Notes.
- Filters: date range, action type, product search.

#### Screen 6 — Admin Settings (/admin)

- Confidence Threshold: slider + numeric input (0–100%), Save calls PATCH /admin/settings.
- Margin Floors: table with Add/Delete per category.
- Product Management: CRUD table.
- Admin-only.

#### Screen 7 — User Management (/admin/users)

- User list: Name, Email, Role badge, Joined.
- Invite User modal (email + role).
- Inline role change dropdown.
- Remove user with confirmation modal.
- Admin-only.

### 9.3 API Client

```typescript
// frontend/src/lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      await refreshAccessToken()
      return api(err.config)
    }
    return Promise.reject(err)
  }
)

export default api
```

### 9.4 Component State Pattern (Mandatory for Every Screen)

```typescript
const [data, setData] = useState<T | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  api.get('/endpoint')
    .then(res => setData(res.data))
    .catch(err => setError(err.message))
    .finally(() => setLoading(false))
}, [])

if (loading) return <LoadingSkeleton />        // shape-matching skeleton
if (error)   return <ErrorBanner onRetry={refetch} message={error} />
if (!data?.length) return <EmptyState />
return <Content data={data} />
```

### 9.5 Route Protection

- `(dashboard)/layout.tsx`: if no user in AuthContext → redirect to /login.
- `/admin` and `/admin/users`: if user.role !== 'ADMIN' → redirect to /.

---

## 10. Shared Validation (Zod)

Schemas in `/shared/src/schemas/` imported by both frontend and backend.

```typescript
// auth.schema.ts
export const SignupSchema = z.object({
  orgName: z.string().min(2).max(100),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
})
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// product.schema.ts
export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  cost_of_goods: z.number().positive(),
  current_price: z.number().positive(),
})

// recommendation.schema.ts
export const ModifyPriceSchema = z.object({ new_price: z.number().positive() })
export const RejectSchema = z.object({ reason: z.string().min(5).max(500) })

// admin.schema.ts
export const OrgSettingsSchema = z.object({
  confidence_threshold: z.number().min(0).max(1),
})
export const MarginFloorSchema = z.object({
  category: z.string().min(1),
  min_margin: z.number().min(0).max(1),
})
```

Backend: `Schema.safeParse(req.body)` → if !success → HTTP 400 with issues array.
Frontend: `Schema.safeParse(formData)` → show field-level errors before submitting.

---

## 11. Seed Data & Demo Scenarios

The seed script `backend/prisma/seed.ts` runs automatically on `docker compose up` via the migrate service. Idempotent (upserts where possible).

### Two Organizations

| Org | Admin | Analyst | Confidence Threshold |
|---|---|---|---|
| TechMart Inc. | admin@techmart.com / Demo1234! | analyst@techmart.com / Demo1234! | 80% |
| StyleZone | admin@stylezone.com / Demo1234! | analyst@stylezone.com / Demo1234! | 75% |

**TechMart margin floors:** Electronics 15%, Sports & Outdoors 20%.
**StyleZone margin floors:** Clothing 25%, Home & Kitchen 18%.

### Product Catalog (8–10 products per org)

Categories: Electronics, Clothing, Home & Kitchen, Sports & Outdoors.
Each product seeded with 30 days of: competitor price records (2–3 competitors/day), demand signals (1/day), inventory snapshots (1/day).

### Guaranteed Demo Scenarios

| # | Name | Product | Trigger | AI Result | Status |
|---|---|---|---|---|---|
| 1 | Amazon Price Drop | Sony WH-1000XM5 (Electronics, TechMart) | Seed | Competitor -22% → Agent 4 recommends -18%, confidence 87% → Agent 5 auto-executes (87% > 80%) | AUTO_EXECUTED |
| 2 | Margin Floor Violation | Cheap USB Cable (Electronics, TechMart) | Seed | Price recommendation would break 15% margin floor → Agent 3 flags → Agent 5 blocks | FAILED |
| 3 | Human Review Required | Seasonal Jacket (Clothing, StyleZone) | Seed | Mixed signals → confidence 55% → below 75% threshold → queued | PENDING |
| 4 | High Demand / Low Stock | Running Shoes (Sports, TechMart) | Seed | Rising demand + stock < 20 → price increase recommendation, confidence 72% → below 80% → queued | PENDING |

---

## 12. Error Handling Strategy

### Backend Error Response Format

```json
{
  "error": "Short human-readable message",
  "details": [...],
  "retryable": false
}
```

`details`: only present for Zod validation errors (array of field-level issues).
`retryable`: only present for AI analysis failures.

### HTTP Status Code Map

| Scenario | Status | Notes |
|---|---|---|
| Zod validation failure | 400 | Includes details array |
| Unauthenticated | 401 | No/invalid/expired JWT |
| Insufficient role | 403 | With role requirement info |
| Resource not found | 404 | Also used for cross-tenant access (prevents enumeration) |
| Groq API failure | 500 | retryable: true |
| Unhandled exception | 500 | Stack trace never leaked in production |

### Mock Store Failure (Not an HTTP error)

- Recommendation.status → FAILED
- Recommendation.store_update_ok → false
- Product.current_price → unchanged
- AuditLog → STORE_UPDATE_FAILED
- HTTP 200 returned with the Recommendation object

### Frontend — Four Mandatory States Per Screen

1. **Loading** — shape-matching skeleton loaders (never generic spinners).
2. **Error** — banner with error message + Retry button that re-runs the fetch.
3. **Empty** — screen-specific empty state with a relevant call-to-action.
4. **Data** — the actual populated content.

No screen may skip any of these four states.

---

## 13. Docker Compose Setup

```yaml
# docker-compose.yml
version: "3.9"

services:
  migrate:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
    command: sh -c "npx prisma migrate deploy && npx prisma db seed"
    restart: "no"

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      GROQ_API_KEY: ${GROQ_API_KEY}
      GROQ_MODEL: ${GROQ_MODEL:-llama3-8b-8192}
      FRONTEND_URL: http://localhost:3000
      SIMULATION_CRON: ${SIMULATION_CRON:-0 */6 * * *}
      SIMULATION_TRIGGER_AI: ${SIMULATION_TRIGGER_AI:-true}
      NODE_ENV: production
    depends_on:
      migrate:
        condition: service_completed_successfully
    command: npm start

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000/api/v1
    depends_on:
      - backend
```

PostgreSQL is provided by Supabase (external cloud). No local DB container needed.

**One-command startup:** `docker compose up --build`

---

## 14. Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://user:password@host:5432/klypup?sslmode=require

# Auth — MUST be different strings, both min 32 chars
JWT_SECRET=your_jwt_access_secret_min_32_chars_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_chars_here

# AI
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-8b-8192

# Server
PORT=4000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Simulation
SIMULATION_CRON=0 */6 * * *
SIMULATION_TRIGGER_AI=true

# Frontend (must be prefixed NEXT_PUBLIC_ for browser access)
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

---

## 15. Implementation Checklist

### Phase 1 — Foundation

- [ ] Monorepo root with frontend/, backend/, shared/
- [ ] shared/ package with Zod schemas and TypeScript types, linked to both apps
- [ ] Prisma schema with all 13 models and all enums
- [ ] Supabase project created, DATABASE_URL configured
- [ ] Initial Prisma migration applied
- [ ] Seed script: 2 orgs, 4 users, 8-10 products per org, 30 days market data, 4 demo scenarios
- [ ] Docker Compose: `docker compose up --build` starts everything cleanly

### Phase 2 — Auth

- [ ] POST /auth/signup — org + user + OrgSettings, return tokens
- [ ] POST /auth/login — verify bcrypt, return tokens
- [ ] POST /auth/refresh — DB hash lookup, token rotation
- [ ] POST /auth/logout — revoke refresh token
- [ ] authenticate.ts, tenantScope.ts, requireRole.ts middleware
- [ ] AuthContext with in-memory accessToken
- [ ] Login page + Signup page with Zod validation + error states
- [ ] axios request interceptor (attach token) + response interceptor (refresh on 401)

### Phase 3 — Product Catalog

- [ ] GET /products with search, filter, sort, pagination
- [ ] GET /products/:id with latest market data
- [ ] POST/PATCH/DELETE /products (Admin)
- [ ] GET /products/:id/price-history, /competitor-prices, /demand-signals
- [ ] Dashboard Home screen (table, all filters, loading/error/empty states)
- [ ] Product Detail screen (Recharts charts, inventory panel, all states)

### Phase 4 — AI Agent System

- [ ] Groq client singleton (groq.ts)
- [ ] All 5 agent modules with typed I/O and Groq prompts
- [ ] orchestrator.ts — sequential, per-agent persist, error containment
- [ ] POST /ai-analysis/:productId/run endpoint
- [ ] mockStore.ts with 20% failure simulation
- [ ] Frontend: loading state showing per-agent progress during analysis

### Phase 5 — Approval Workflow

- [ ] POST /recommendations/:id/approve, /modify, /reject
- [ ] AuditLog creation on every status transition
- [ ] Approval Queue screen (table, inline actions, modals, optimistic updates, all states)
- [ ] Agent breakdown in Product Detail recommendation panel

### Phase 6 — Simulation & Scheduling

- [ ] runSimulationCycle() service with competitor/demand/inventory generators
- [ ] node-cron scheduler wired in index.ts
- [ ] POST /simulation/run + GET /simulation/status
- [ ] "Simulate Market Day" Admin button in Dashboard
- [ ] All 4 demo scenarios functional and demonstrable

### Phase 7 — Admin & Polish

- [ ] GET/PATCH /admin/settings
- [ ] POST/DELETE /admin/settings/margin-floors
- [ ] GET/POST/PATCH/DELETE /admin/users
- [ ] Admin Settings screen (/admin): confidence slider, margin floors, product CRUD
- [ ] User Management screen (/admin/users): invite, role change, remove
- [ ] Audit Trail screen (/audit): filters, pagination
- [ ] Role-based route guards on all admin frontend pages
- [ ] All screens verified: loading / error / empty / data states present
- [ ] .env.example documented
- [ ] README with one-command quick start

---

*Last updated: 2026-07-10 | Aligned with PROJECT_BASE_DOCUMENT.md v1.0*
