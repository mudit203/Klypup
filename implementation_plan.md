# Implementation Plan - Phase 5: Approval Workflow

This plan outlines the implementation of **Phase 5 — Approval Workflow** for the **Klypup Dynamic Pricing Intelligence Dashboard**. We will implement the backend controllers, router, and audit log generation for manual pricing decisions, as well as the frontend `/approval-queue` view and product detail breakdown widgets.

## User Review Required

> [!IMPORTANT]
> **Role Scoping for Approvals**: In accordance with the spec, manual approval actions (`approve`, `modify`, `reject`) will be restricted. We will permit users with the role `ANALYST` or `ADMIN` to perform these actions, blocking general users (if any exist in future scope).
>
> **Storefront Update on Approve/Modify**: Just like the auto-execution pipeline, human approvals will update the storefront via `updateStorePrice()`.
> * If the storefront update **succeeds**: the product's retail price updates in the database, a `PriceHistory` log is created, and the recommendation status is set to `APPROVED` or `MODIFIED`.
> * If the storefront update **fails** (the 20% simulated drop): the price remains unchanged, the recommendation status is set to `FAILED`, and a `STORE_UPDATE_FAILED` log is saved in the audit trail.

---

## Proposed Changes

### Backend Service (`backend`)

We will create controllers and routes to govern pricing recommendations.

#### [NEW] [backend/src/controllers/recommendation.controller.ts](file:///c:/Projects/Klypup/backend/src/controllers/recommendation.controller.ts)
Exposes the recommendation request handlers:
* `getRecommendations`: Returns all recommendations for the organization. Supports filtering by `status` (e.g. `PENDING`) and sorts by `confidence_score` descending.
* `getRecommendationById`: Returns detailed recommendation specs along with its `agent_outputs` ordered by `run_order`.
* `approveRecommendation`: 
  * Checks if the recommendation is currently `PENDING`.
  * Calls `updateStorePrice()` to update storefront price.
  * If successful: Updates product's price, creates a `PriceHistory` record (change source: `ANALYST_APPROVED`), and sets recommendation status to `APPROVED`.
  * Creates an `AuditLog` for action `PRICE_APPROVED`.
* `modifyRecommendation`:
  * Validates request body with `ModifyPriceSchema` (checks for `new_price`).
  * Calls `updateStorePrice()` with the custom price.
  * If successful: Updates product's price, creates a `PriceHistory` record (change source: `ANALYST_MODIFIED`), and sets recommendation status to `MODIFIED` and its `final_price` field.
  * Creates an `AuditLog` for action `PRICE_MODIFIED`.
* `rejectRecommendation`:
  * Validates request body with `RejectSchema` (checks for `reason`).
  * Sets recommendation status to `REJECTED` and its `analyst_note` field to the rejection reason.
  * Creates an `AuditLog` for action `PRICE_REJECTED`.

#### [NEW] [backend/src/routes/recommendation.routes.ts](file:///c:/Projects/Klypup/backend/src/routes/recommendation.routes.ts)
Maps endpoints and applies `authenticate` + `tenantScope` middlewares:
* `GET /` -> `getRecommendations`
* `GET /:id` -> `getRecommendationById`
* `POST /:id/approve` -> `approveRecommendation`
* `POST /:id/modify` -> `modifyRecommendation`
* `POST /:id/reject` -> `rejectRecommendation`

#### [MODIFY] [backend/src/index.ts](file:///c:/Projects/Klypup/backend/src/index.ts)
Register `/api/v1/recommendations` routes.

---

### Frontend Service (`frontend`)

We will build the approval interface.

#### [NEW] [frontend/src/app/approval-queue/page.tsx](file:///c:/Projects/Klypup/frontend/src/app/approval-queue/page.tsx)
* Displays a table of all `PENDING` recommendations.
* Lists columns: Product Name, AI Recommended Price, Current Price, Delta, Confidence progress bar, Trigger, and creation date.
* Inline buttons:
  * **Approve**: Sends approve request.
  * **Modify**: Opens a dialog to enter a custom price, then sends modify request.
  * **Reject**: Opens a dialog to enter a reason, then sends reject request.
* **Optimistic UI Updates**: Immediately filters out the affected row from the state on click and displays a success banner.
* Auto-redirects to `/login` if session is missing.

#### [MODIFY] [frontend/src/app/products/[id]/page.tsx](file:///c:/Projects/Klypup/frontend/src/app/products/[id]/page.tsx)
* Fetches the latest recommendation for the product during mount.
* If a recommendation is `PENDING` and the user's role is `ANALYST` or `ADMIN`, displays:
  * A **Recommendation Summary Panel** showing delta, trigger, and a confidence progress bar.
  * a **5-Agent Collapsible Breakdown**: lists what each agent outputted (summaries and checkmarks).
  * **Approve / Modify / Reject Action Buttons** at the bottom of the panel. Clicking them performs the action and refreshes the page details.

---

## Verification Plan

### Automated Tests
* Verify TypeScript compilation via `pnpm build`.

### Manual Verification
1. **Approval Queue Listing**: Login as `analyst@techmart.com` and visit `/approval-queue`. Verify that pending recommendations created during seeding display correctly.
2. **Approve Action**: Click "Approve" on a row. Verify that:
   * The row is optimistically removed from the UI.
   * Product retail price updates in the database (or goes to failed state if storefront simulation drops).
   * A new row is written to `AuditLog`.
3. **Rejection Action**: Click "Reject" on a row, enter a reason. Verify that the recommendation status is set to `REJECTED`, and the reason is saved in `analyst_note`.
