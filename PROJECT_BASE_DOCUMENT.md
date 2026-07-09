# Project Base Document — Dynamic Pricing Intelligence Dashboard

## 1. What This Project Is

A full-stack web application for an e-commerce company's pricing team. The app monitors market conditions (competitor prices, demand trends, inventory levels) and uses a team of AI agents to generate pricing recommendations. A human (Pricing Analyst) reviews and approves these recommendations before they go live, unless the AI's confidence is high enough to auto-execute the change. Every decision is logged.

The app supports multiple companies (organizations) using it at once, with each organization's data fully isolated from others, and two user roles with different permissions.

---

## 2. Who Uses This App

**Two roles, per organization:**

- **Admin** — manages the product catalog, sets the AI confidence threshold for auto-approval, sets minimum profit margins per category, manages users/org settings.
- **Pricing Analyst** — reviews AI-generated pricing recommendations and approves, rejects, or manually adjusts them.

**Multi-tenant:** Multiple organizations can use the same app. Org A can never see Org B's products, prices, recommendations, or logs. Users belong to exactly one organization.

---

## 3. Core User Flows

### Flow 1 — Everyday Monitoring
1. Analyst logs in and sees the product catalog dashboard: all products, current price, competitor price, margin, stock status, and recommendation status (pending / approved / rejected / auto-executed).
2. Analyst can filter, search, and sort this list.

### Flow 2 — AI Pricing Analysis
1. A pricing analysis is triggered for a product (either automatically after a market change, or manually by clicking "Run Analysis").
2. Five AI agents run in sequence/parallel, each analyzing one part of the picture (market, demand, inventory, then a final strategy agent, then an execution check — full detail in Section 5).
3. The result is a recommended new price, a confidence score (0–100%), and a plain-language explanation of why.

### Flow 3 — Approval Decision
1. If the confidence score is **above** the org's configured threshold → the price change **auto-executes** immediately.
2. If the confidence score is **below** the threshold → it goes into a **pending queue** for a Pricing Analyst.
3. The analyst opens the recommendation, sees the full reasoning (what each agent found), and chooses:
   - **Approve** — the recommended price goes live as-is.
   - **Modify** — analyst types a different price, and that price goes live instead.
   - **Reject** — nothing changes; analyst must give a reason.
4. Whatever happens, it's recorded in the **audit trail**: what was recommended, what actually happened, who did it, and when.

### Flow 4 — Market Simulation (for demo purposes)
Since there's no real live store connected, the app includes a way to simulate market changes (competitor price moves, demand shifts, inventory changes) so the AI agents always have fresh, realistic data to react to. This can be triggered manually (e.g. a "Simulate Next Market Day" button) or run automatically on a schedule.

### Flow 5 — Admin Configuration
Admin can, from a settings screen:
- Set the confidence threshold for auto-execution (e.g. 80%).
- Set minimum margin floors per product category (AI should never recommend a price that violates this).
- Manage the product catalog (add/edit/remove products).
- Manage which users belong to the organization.

---

## 4. What the App Must Show (Screens)

1. **Login / Signup** — account creation and org creation/joining.
2. **Dashboard Home** — product catalog table with filters, search, sort, and recommendation status.
3. **Product Detail / Recommendation Detail View** — shows current price, full price history, competitor price history, and (if a recommendation exists) the full breakdown of what each AI agent concluded, the final recommendation, confidence score, and rationale.
4. **Approval Queue** — list of all pending recommendations, sorted by confidence score, with quick approve/reject/modify actions.
5. **Audit Trail** — searchable/filterable log of every price change ever made.
6. **Admin Settings Panel** — confidence threshold, margin floors, category management, user management (admin-only).
7. **Org / User Management** — invite users, see who belongs to the organization.

---

## 5. The AI Agent System (Core Feature)

Five specialized agents work together to produce one final pricing decision. Each agent has one clear job:

| Agent | Job |
|---|---|
| **Market Intelligence Agent** | Looks at recent competitor price movements for the product and summarizes what's happening (e.g. "Amazon dropped price 15% yesterday"). |
| **Demand Forecasting Agent** | Looks at demand/trend signals for the product (seasonality, rising/falling interest) and summarizes demand direction. |
| **Inventory & Cost Agent** | Checks current stock level, cost of goods, and the category's minimum margin rule. Flags if stock is too low/high, or if a price change would break the margin floor. |
| **Pricing Strategy Agent** | Takes the outputs of the three agents above and decides: should the price change, by how much, and how confident is this recommendation? Produces a written rationale. |
| **Execution & Compliance Agent** | Checks the recommendation against business rules (margin floor, confidence threshold) and decides: auto-execute, or send to a human for approval. |

**Important behavior:** Every recommendation must clearly show which data influenced it (which agent said what), so a human reviewing it can understand the "why," not just the "what."

---

## 6. Data the App Needs to Simulate (Mock Data)

Since there's no real store connected, the app generates its own realistic fake data:

1. **Competitor Prices** — a history of competitor prices per product over time, including realistic events: no change, small fluctuation, price drop, price increase, or a new competitor entering the market. Old prices are kept as history, not overwritten, so trends can be tracked.
2. **Demand Signals** — a history of how much "interest"/demand each product has, with seasonal ups and downs depending on category.
3. **Inventory & Cost Data** — current stock level and cost-of-goods per product, changing over time (stock decreasing with simulated sales, occasional restocks).
4. **Mock Store Price Update** — a fake "store system" endpoint that the app calls when a price change is executed. It should occasionally simulate failure, so the app can show proper error handling (i.e. don't record a price as changed if the mock store update failed).

At least one realistic, guaranteed demo scenario should be pre-loaded (e.g. a specific product where a competitor has clearly dropped price), so there's always something meaningful to show during a live demo.

---

## 7. Required Functional Rules

- **Authentication is real** — proper signup/login/logout, no hardcoded test users, protected pages that require login.
- **Data isolation is enforced everywhere** — every piece of data (products, recommendations, audit logs) belongs to one organization, and no user can ever see or affect another organization's data, even by mistake or manipulation.
- **Roles enforce real restrictions** — an Analyst cannot change admin settings; only an Admin can.
- **Every price change is logged** — no price should ever change without a traceable record of what triggered it and who approved it (even if "auto-executed" by AI).
- **The app must not crash if the AI fails** — if the AI service is slow, times out, or errors, the app should show a clear error/retry state, not break.
- **Every screen must handle three states** — loading, empty (no data yet), and error — not just the "happy path" with data.

---

## 8. What Success Looks Like

- A working app that can be run locally (ideally with one command) and immediately shows realistic, populated data — not an empty shell.
- A user can log in, see the product catalog, trigger an AI pricing analysis, watch the five agents produce a recommendation, and either see it auto-execute or approve/reject/modify it themselves.
- Two separate organizations can be demonstrated side-by-side, proving their data never mixes.
- Two different roles can be demonstrated showing different available actions.
- Every price change, whether automatic or human-approved, can be traced in the audit trail.
- The market simulation can be triggered live, showing the AI reacting to new data in real time.

---

## 9. What's Explicitly Out of Scope (for this version)

- Connecting to any real e-commerce platform or real competitor scraping — everything is simulated/mocked.
- Payment processing or real financial transactions.
- Complex enterprise-grade infrastructure (this should be a clean, correct, understandable implementation — not an over-engineered one).
