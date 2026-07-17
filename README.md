# Klypup — Dynamic Pricing Intelligence Dashboard

Klypup is a full-stack, multi-tenant web application built for e-commerce pricing teams. It monitors competitor prices, demand trends, and inventory levels, then runs a pipeline of five specialized AI agents to generate pricing recommendations. A human analyst can review, approve, modify, or reject those recommendations before they go live — or the system can auto-execute them when confidence is high enough. Every decision is recorded in an immutable audit trail.

The project is designed to be a self-contained, locally runnable demo with realistic simulated market data. No real store or competitor scraping is involved.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Node.js, Express 4, TypeScript |
| Database | PostgreSQL via Neon (serverless), Prisma ORM |
| AI / LLM | Groq SDK, Llama 3 (8B) — `llama3-8b-8192` by default |
| Auth | JWT (access + refresh token rotation), bcrypt, HTTP-only cookies |
| Validation | Zod schemas shared across frontend and backend via a monorepo package |
| Monorepo | pnpm workspaces |
| Scheduling | node-cron (background market simulation tick) |
| Charts | Recharts |
| Icons | lucide-react |

---

## Application Preview

<p align="center">
  <strong>Login Page</strong>
  <br />
  <img src="./assets/Screenshot%202026-07-17%20182043.png" alt="Dynamic Pricing Dashboard" width="800" />
</p>

<p align="center">
  <strong>Product listings dashboard</strong>
  <br />
  <img src="./assets/Screenshot%202026-07-17%20182111.png" alt="Pending Approval Queue" width="800" />
</p>

<p align="center">
  <strong>Product dashboard</strong>
  <br />
  <img src="./assets/Screenshot%202026-07-17%20182127.png" alt="Admin Control Panel" width="800" />
</p>

<p align="center">
  <strong>Pending approval queue</strong>
  <br />
  <img src="./assets/image.png" alt="Admin Control Panel" width="800" />
</p>
---

## Repository Structure

* [backend/](file:///c:/Projects/Klypup/backend) — Express API server
  * [prisma/](file:///c:/Projects/Klypup/backend/prisma)
    * [schema.prisma](file:///c:/Projects/Klypup/backend/prisma/schema.prisma) — Full database schema
    * [seed.ts](file:///c:/Projects/Klypup/backend/prisma/seed.ts) — Seeds two demo orgs with realistic data
  * [src/](file:///c:/Projects/Klypup/backend/src)
    * [index.ts](file:///c:/Projects/Klypup/backend/src/index.ts) — Server entry point, route registration, cron boot
    * [controllers/](file:///c:/Projects/Klypup/backend/src/controllers) — Request handlers per domain
      * [auth.controller.ts](file:///c:/Projects/Klypup/backend/src/controllers/auth.controller.ts)
      * [product.controller.ts](file:///c:/Projects/Klypup/backend/src/controllers/product.controller.ts)
      * [recommendation.controller.ts](file:///c:/Projects/Klypup/backend/src/controllers/recommendation.controller.ts)
      * [admin.controller.ts](file:///c:/Projects/Klypup/backend/src/controllers/admin.controller.ts)
      * [audit.controller.ts](file:///c:/Projects/Klypup/backend/src/controllers/audit.controller.ts)
    * [routes/](file:///c:/Projects/Klypup/backend/src/routes) — Express routers
      * [auth.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/auth.routes.ts)
      * [product.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/product.routes.ts)
      * [ai.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/ai.routes.ts)
      * [recommendation.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/recommendation.routes.ts)
      * [simulation.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/simulation.routes.ts)
      * [admin.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/admin.routes.ts)
      * [audit.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/audit.routes.ts)
    * [services/](file:///c:/Projects/Klypup/backend/src/services)
      * [orchestrator.ts](file:///c:/Projects/Klypup/backend/src/services/orchestrator.ts) — Runs and sequences the five AI agents
      * [simulation.service.ts](file:///c:/Projects/Klypup/backend/src/services/simulation.service.ts) — Market simulation logic
      * [agents/](file:///c:/Projects/Klypup/backend/src/services/agents)
        * [marketIntelligence.ts](file:///c:/Projects/Klypup/backend/src/services/agents/marketIntelligence.ts)
        * [demandForecasting.ts](file:///c:/Projects/Klypup/backend/src/services/agents/demandForecasting.ts)
        * [inventoryCost.ts](file:///c:/Projects/Klypup/backend/src/services/agents/inventoryCost.ts)
        * [pricingStrategy.ts](file:///c:/Projects/Klypup/backend/src/services/agents/pricingStrategy.ts)
        * [executionCompliance.ts](file:///c:/Projects/Klypup/backend/src/services/agents/executionCompliance.ts)
    * [middleware/](file:///c:/Projects/Klypup/backend/src/middleware)
      * [authenticate.ts](file:///c:/Projects/Klypup/backend/src/middleware/authenticate.ts) — JWT bearer token verification
      * [requireRole.ts](file:///c:/Projects/Klypup/backend/src/middleware/requireRole.ts) — Role-based access control (ADMIN / ANALYST)
      * [tenantScope.ts](file:///c:/Projects/Klypup/backend/src/middleware/tenantScope.ts) — Attaches orgId to request context
    * [lib/](file:///c:/Projects/Klypup/backend/src/lib)
      * [groq.ts](file:///c:/Projects/Klypup/backend/src/lib/groq.ts) — Groq SDK client and callGroqAgent helper
      * [mockStore.ts](file:///c:/Projects/Klypup/backend/src/lib/mockStore.ts) — Simulated storefront price-update endpoint
      * [prisma.ts](file:///c:/Projects/Klypup/backend/src/lib/prisma.ts) — Shared Prisma client singleton
    * [scheduler/](file:///c:/Projects/Klypup/backend/src/scheduler)
      * [marketSimulation.cron.ts](file:///c:/Projects/Klypup/backend/src/scheduler/marketSimulation.cron.ts) — node-cron job (runs every 6 hours by default)
* [frontend/](file:///c:/Projects/Klypup/frontend) — Next.js application
  * [src/](file:///c:/Projects/Klypup/frontend/src)
    * [app/](file:///c:/Projects/Klypup/frontend/src/app)
      * [page.tsx](file:///c:/Projects/Klypup/frontend/src/app/page.tsx) — Dashboard home — product catalog table
      * [layout.tsx](file:///c:/Projects/Klypup/frontend/src/app/layout.tsx) — Root layout with AuthProvider
      * [(auth)/](file:///c:/Projects/Klypup/frontend/src/app/\(auth\)) — Login and signup pages
      * [products/[id]/](file:///c:/Projects/Klypup/frontend/src/app/products) — Product detail and recommendation breakdown
      * [approval-queue/](file:///c:/Projects/Klypup/frontend/src/app/approval-queue) — Pending recommendations list
      * [audit/](file:///c:/Projects/Klypup/frontend/src/app/audit) — Audit trail log
      * [admin/](file:///c:/Projects/Klypup/frontend/src/app/admin) — Admin settings and user management
    * [context/](file:///c:/Projects/Klypup/frontend/src/context)
      * [AuthContext.tsx](file:///c:/Projects/Klypup/frontend/src/context/AuthContext.tsx) — Global auth state, login/signup/logout actions
    * [lib/](file:///c:/Projects/Klypup/frontend/src/lib)
      * [api.ts](file:///c:/Projects/Klypup/frontend/src/lib/api.ts) — Axios instance with silent token refresh interceptor
* [shared/](file:///c:/Projects/Klypup/shared) — @klypup/shared — Zod schemas and inferred types
  * [src/](file:///c:/Projects/Klypup/shared/src)
    * [index.ts](file:///c:/Projects/Klypup/shared/src/index.ts) — Re-exports all schemas and types
    * [schemas/](file:///c:/Projects/Klypup/shared/src/schemas)
      * [auth.schema.ts](file:///c:/Projects/Klypup/shared/src/schemas/auth.schema.ts) — SignupSchema, LoginSchema
      * [product.schema.ts](file:///c:/Projects/Klypup/shared/src/schemas/product.schema.ts) — CreateProductSchema
      * [recommendation.schema.ts](file:///c:/Projects/Klypup/shared/src/schemas/recommendation.schema.ts) — ModifyPriceSchema, RejectSchema
      * [admin.schema.ts](file:///c:/Projects/Klypup/shared/src/schemas/admin.schema.ts) — OrgSettingsSchema, MarginFloorSchema

---

## Environment Variables

Copy `.env.example` to `.env` at the root and inside the backend directory. The variables you need to fill in:

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | backend | PostgreSQL connection string (pooled, e.g., Neon) |
| `DIRECT_URL` | backend | Direct (non-pooled) connection for Prisma migrations |
| `JWT_SECRET` | backend | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | backend | Secret for signing refresh tokens (min 32 chars) |
| `GROQ_API_KEY` | backend | API key from console.groq.com |
| `GROQ_MODEL` | backend | LLM model ID, defaults to `llama3-8b-8192` |
| `PORT` | backend | API server port, defaults to `4000` |
| `FRONTEND_URL` | backend | CORS origin for the frontend, defaults to `http://localhost:3000` |
| `SIMULATION_CRON` | backend | Cron expression for automatic market ticks, defaults to `0 */6 * * *` |
| `SIMULATION_TRIGGER_AI` | backend | Set to `true` to auto-run AI analysis after each simulation tick |
| `NEXT_PUBLIC_API_URL` | frontend | Base URL the browser uses to reach the API |

---

## Getting Started

### Prerequisites
Before running the application, make sure you have the following installed on your machine:
* **Node.js** (v18 or higher)
* **pnpm** (v9 or higher)
* **PostgreSQL Database** (e.g., via Neon, Supabase, or a local installation)
* **Groq API Key** (required for the AI agent pricing analysis pipeline)

---

### Step 1: Clone and Install Dependencies
Install all workspace dependencies from the root directory:
```bash
pnpm install
```

---

### Step 2: Configure Environment Variables
Copy the workspace-level template [.env.example](file:///c:/Projects/Klypup/.env.example) to create a backend `.env` file:
```bash
cp .env.example backend/.env
```

Open [backend/.env](file:///c:/Projects/Klypup/backend/.env) and update the following configuration variables:
```env
# Database Connection (Connection Pooler URI on port 6543)
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"

# Direct Connection (Direct Session URI on port 5432)
DIRECT_URL="postgresql://user:password@host:5432/postgres"

# Auth Secrets (Set to secure 32-character strings)
JWT_SECRET="your_jwt_access_secret_here"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_here"

# Groq AI Keys
GROQ_API_KEY="gsk_your_actual_groq_api_key_here"
```

For the frontend, you can optionally create a root `.env` file containing the backend endpoint:
```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
```

---

### Step 3: Build the Shared Library
Build the shared schemas and Zod validators which both the frontend and backend require:
```bash
pnpm build:shared
```

---

### Step 4: Database Setup (Prisma Client & Seeding)
Navigate into the `/backend` folder, compile the Prisma client, deploy the database tables, and run the seed script:
```bash
cd backend

# Generate the Prisma client
npx prisma generate

# Deploy migrations to your database
npx prisma migrate deploy

# Seed the database with demo products, competitor prices, and historical logs
npx prisma db seed

# Return to the root folder
cd ..
```

---

### Step 5: Start the Development Servers
Open two terminal windows to run the frontend and backend concurrently from the root directory:

**Terminal 1 (Backend API Server)**:
```bash
pnpm dev:backend
```
*The server will start running at `http://localhost:4000`.*

**Terminal 2 (Frontend Next.js App)**:
```bash
pnpm dev:frontend
```
*The application interface will be accessible at `http://localhost:3000`.*

---

### Step 6: Log In with Demo Accounts
The seed script configures two pre-populated organizations so you can test the multi-tenant system immediately.

#### Organization 1: TechMart Inc.
* **Admin User**:
  * Email: `admin@techmart.com`
  * Password: `Demo1234!`
* **Analyst User**:
  * Email: `analyst@techmart.com`
  * Password: `Demo1234!`

#### Organization 2: StyleZone
* **Admin User**:
  * Email: `admin@stylezone.com`
  * Password: `Demo1234!`
* **Analyst User**:
  * Email: `analyst@stylezone.com`
  * Password: `Demo1234!`

---

## Core Concepts

**Multi-tenancy**
Every piece of data — products, recommendations, audit logs — is tagged with an `org_id`. Every API route passes through the `tenantScope` middleware, which attaches the authenticated user's `org_id` to the request. All database queries filter by `org_id`, so users from one organization can never access another organization's data.

**Two Roles**
Each user is either `ADMIN` or `ANALYST`. Admins can manage the product catalog, configure the confidence threshold, set margin floors, and invite users. Analysts can browse the catalog, trigger AI analysis, and act on the approval queue. The `requireRole` middleware enforces this at the route level.

**Auto-execution vs Human Review**
Each organization has a configurable `confidence_threshold` (default 80%). When the Pricing Strategy Agent produces a recommendation, the Execution Compliance Agent compares the confidence score against this threshold. If the score meets or exceeds it, the price is changed immediately and the event is logged as `AI_AUTO_EXECUTED`. If it falls short, the recommendation sits in the approval queue for a human decision.

**Audit Trail**
Every state-changing event writes an `AuditLog` record: auto-executions, analyst approvals, modifications, rejections, simulation runs, user role changes, and settings updates. The log is append-only and always records the `old_price`, `new_price`, `product_name`, acting `user_id`, and a plain-text `notes` field.

---

## The AI Agent Pipeline

When analysis is triggered — either manually from the product detail page or automatically by the market simulation — the backend runs a pipeline of five agents in sequence. The orchestrator in `services/orchestrator.ts` manages this flow.

Agents 1, 2, and 3 run in parallel (`Promise.all`). Agent 4 runs after all three complete, and Agent 5 runs after Agent 4.

Each agent's output is saved to the `AgentOutput` table with its `run_order`, `summary`, `data_used`, and structured `output` JSON, so the frontend can display exactly what each agent saw and concluded.

### Agent 1 — Market Intelligence
Takes the last 30 days of `CompetitorPrice` records for the product. Calls the LLM with a structured prompt asking it to identify competitor price trends, flag notable events (drops or increases above 5%), name the biggest mover, and return the percentage change.

Output fields: `summary`, `notable_event`, `competitor_trend` (DOWN / UP / STABLE / MIXED), `biggest_competitor`, `biggest_price_delta_pct`.

### Agent 2 — Demand Forecasting
Takes the last 30 days of `DemandSignal` records and the product's category. Calls the LLM to summarize the demand direction and seasonality context. The category is embedded in the prompt so the model can reason about whether, for example, electronics demand is expected to be high in Q4.

Output fields: `summary`, `demand_direction` (UP / DOWN / STABLE), `seasonality_factor` (PEAK / DIP / NEUTRAL), `pricing_implication` (INCREASE / DECREASE / HOLD).

### Agent 3 — Inventory and Cost
This agent does most of its reasoning in code before calling the LLM. It computes the current profit margin percentage, compares it against the category's minimum margin floor, and categorizes stock level as LOW (below 20 units), NORMAL, or HIGH (above 200 units). It derives a `pricing_implication` deterministically from stock status. The LLM is only called to write the plain-English `summary` field — if the LLM call fails, a fallback summary is generated from the computed values.

Output fields: `summary`, `stock_status`, `current_margin_pct`, `margin_floor_pct`, `margin_floor_violated`, `pricing_implication`.

### Agent 4 — Pricing Strategy
Takes the outputs of Agents 1, 2, and 3 as structured JSON and the product's current price. Calls the LLM to synthesize everything into a final price recommendation and a confidence score (0–100). The prompt includes hard rules: if the margin floor is violated, the recommended price must correct that first. If demand is rising and inventory is low, lean toward a price increase. If competitors have dropped significantly and margins allow, consider matching them.

Output fields: `summary`, `recommended_price`, `confidence_score`, `rationale`, `reasoning_factors` (string array).

### Agent 5 — Execution and Compliance
This agent does not call the LLM. It applies three deterministic business rules:
1. If the margin floor is violated, the decision is `BLOCK` and the recommendation is saved as `FAILED`.
2. If the confidence score (as a decimal, e.g., 85 / 100 = 0.85) meets or exceeds the organization's `confidence_threshold`, the decision is `AUTO_EXECUTE`.
3. Otherwise, the decision is `QUEUE_FOR_REVIEW` and the recommendation stays `PENDING` for a human.

When `AUTO_EXECUTE` fires, the orchestrator calls `updateStorePrice` (the mock storefront), and only if that succeeds does it run a Prisma transaction to update the product's `current_price`, insert a `PriceHistory` record, and mark the recommendation as `AUTO_EXECUTED`.

---

## Authentication and Authorization

The backend uses a dual-token system. Access tokens are short-lived JWTs (15 minutes) signed with `JWT_SECRET`. Refresh tokens are longer-lived JWTs (7 days) signed with `JWT_REFRESH_SECRET`. The raw refresh token is never stored — only its bcrypt hash is saved in the `RefreshToken` table.

On login or signup, the server:
1. Issues an access token (returned in the JSON response body).
2. Issues a refresh token, hashes it, stores the hash in the database, and sets the raw token as an HTTP-only cookie.

The frontend stores the access token in memory (not `localStorage`). The Axios interceptor in `frontend/src/lib/api.ts` catches any 401 response, silently calls `POST /auth/refresh` using the cookie, and retries the original request with the new token. If the refresh also fails, it dispatches an `auth-logout` browser event, which the `AuthContext` listener catches to clear the user state.

On logout, the server revokes the refresh token in the database by setting `revoked = true` and clears the cookie.

The first user who signs up for an organization is automatically given the `ADMIN` role. Users subsequently invited through the admin panel receive the `ANALYST` role by default.

---

## Market Simulation Engine

The simulation engine runs once per market "tick" and processes every active product across all organizations. For each product it does three things:

* **Competitor prices**: It tracks the latest known price per competitor. On each tick, it rolls a weighted random event: 50% no change, 20% small fluctuation (±3%), 15% price drop (5–20%), 10% price increase (5–15%), 5% new competitor entry. Each event is saved as a new `CompetitorPrice` row — old data is never overwritten, so the full price history remains queryable.
* **Demand signals**: It computes a `demand_index` (10–100) by applying a seasonality multiplier based on the product's category and the current calendar month, then adding ±10% noise. Electronics peaks in Q4, clothing peaks in spring and fall, sports items peak in spring and summer. The resulting `DemandTrend` label (SEASONAL_PEAK, SEASONAL_DIP, RISING, FALLING, STABLE) is saved alongside the index.
* **Inventory**: It calculates units sold based on the demand index and subtracts them from the current stock level. There is a 10% chance each tick of a restock shipment adding 100–500 units.

If `triggerAi` is enabled (either via the `SIMULATION_TRIGGER_AI` environment variable for the scheduled cron, or via the API call parameter), the engine fires the AI orchestrator pipeline for every product after updating its market data. These are fire-and-forget — one product's AI failure does not block others.

The simulation can also be triggered manually by any authenticated user via `POST /api/v1/simulation/run`.

The background scheduler (`scheduler/marketSimulation.cron.ts`) runs the simulation on a cron schedule. The default expression is `0 */6 * * *` (every 6 hours), configurable via the `SIMULATION_CRON` environment variable.

---

## API Routes

All routes are prefixed with `/api/v1`. Every route except auth requires a valid `Authorization: Bearer <token>` header.

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/auth/signup` | No | — | Create a new org and admin user |
| POST | `/auth/login` | No | — | Log in and receive tokens |
| POST | `/auth/logout` | No | — | Revoke refresh token and clear cookie |
| POST | `/auth/refresh` | Cookie | — | Exchange refresh cookie for a new access token |
| GET | `/auth/me` | Yes | Any | Get the current authenticated user |
| GET | `/products` | Yes | Any | List all active products for the org |
| POST | `/products` | Yes | ADMIN | Create a new product |
| GET | `/products/:id` | Yes | Any | Get a single product with full market data |
| PATCH | `/products/:id` | Yes | ADMIN | Update a product |
| DELETE | `/products/:id` | Yes | ADMIN | Soft-delete a product |
| POST | `/ai-analysis/:productId/run` | Yes | Any | Trigger the 5-agent AI pipeline for a product |
| GET | `/ai-analysis/:productId/latest` | Yes | Any | Get the most recent analysis result with agent outputs |
| GET | `/recommendations` | Yes | Any | List all recommendations (filterable by status) |
| GET | `/recommendations/:id` | Yes | Any | Get one recommendation with agent outputs |
| POST | `/recommendations/:id/approve` | Yes | ANALYST | Approve a pending recommendation |
| POST | `/recommendations/:id/modify` | Yes | ANALYST | Approve with a custom price |
| POST | `/recommendations/:id/reject` | Yes | ANALYST | Reject a pending recommendation |
| POST | `/simulation/run` | Yes | Any | Manually trigger one market simulation cycle |
| GET | `/admin/settings` | Yes | ADMIN | Get org settings and margin floors |
| PATCH | `/admin/settings` | Yes | ADMIN | Update confidence threshold |
| POST | `/admin/margin-floors` | Yes | ADMIN | Add a margin floor for a category |
| PATCH | `/admin/margin-floors/:id` | Yes | ADMIN | Update a margin floor |
| DELETE | `/admin/margin-floors/:id` | Yes | ADMIN | Remove a margin floor |
| GET | `/admin/users` | Yes | ADMIN | List users in the org |
| POST | `/admin/users` | Yes | ADMIN | Invite a new user |
| PATCH | `/admin/users/:userId/role` | Yes | ADMIN | Change a user's role |
| GET | `/audit` | Yes | Any | Get the org's audit log |
