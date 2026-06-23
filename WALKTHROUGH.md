# Hermes — Project Walkthrough

A deep-dive guide through the Hermes codebase: how every layer works, how data flows from database to analysis to the browser, and how to deploy the platform.

---

## Table of Contents

- [Repository Layout](#repository-layout)
- [Technology Stack](#technology-stack)
- [Backend Architecture](#backend-architecture)
  - [Entry Point](#entry-point)
  - [Database Layer](#database-layer)
  - [Service Layer](#service-layer)
  - [REST API Routes](#rest-api-routes)
  - [Authentication & Middleware](#authentication--middleware)
- [Risk Analysis Engine](#risk-analysis-engine)
  - [Event Risk (Serper + OpenRouter)](#event-risk-serper--openrouter)
  - [Weather Risk (OpenWeatherMap)](#weather-risk-openweathermap)
  - [Operational Risk (Haversine)](#operational-risk-haversine)
  - [Combined Risk Score](#combined-risk-score)
  - [Route Scorer](#route-scorer)
  - [Smart Router (Recommendations)](#smart-router-recommendations)
- [Analysis Pipeline — End to End](#analysis-pipeline--end-to-end)
- [Real-Time Updates (Socket.io)](#real-time-updates-socketio)
- [Background Workers & Scheduling](#background-workers--scheduling)
- [Frontend Architecture](#frontend-architecture)
  - [Routing & Auth](#routing--auth)
  - [Pages](#pages)
  - [Hooks](#hooks)
  - [Components](#components)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Key Design Decisions](#key-design-decisions)

---

## Repository Layout

```
Hermes/
├── package.json              # Monorepo root (npm workspaces)
├── apps/
│   ├── backend/
│   │   ├── package.json      # @hermes/backend
│   │   ├── tsconfig.json     # CommonJS build target
│   │   ├── drizzle.config.ts # Drizzle-kit → Neon PostgreSQL
│   │   └── src/
│   │       ├── server.ts           # Express + HTTP + Socket.io bootstrap
│   │       ├── database/
│   │       │   ├── schema.ts       # Drizzle ORM table definitions
│   │       │   └── drizzle.ts      # Neon serverless pool + drizzle client
│   │       ├── middleware/
│   │       │   └── auth.ts         # Clerk JWT verification + org scoping
│   │       ├── routes/             # Express routers (7 modules)
│   │       ├── services/           # Database CRUD abstractions (6 modules)
│   │       ├── risk/               # Risk scoring engine (6 modules + prompts/)
│   │       ├── workers/
│   │       │   └── analysis-worker.ts  # BullMQ worker (15-step pipeline)
│   │       ├── queues/
│   │       │   └── queue.ts        # BullMQ queue + Upstash Redis connection
│   │       ├── jobs/
│   │       │   └── schedule.ts     # node-cron midnight job
│   │       ├── socket/
│   │       │   └── index.ts        # Socket.io server + org-scoped rooms
│   │       └── lib/
│   │           └── logger.ts       # Pino structured logger
│   │
│   └── frontend/
│       ├── package.json      # @hermes/frontend (Vite + React 19)
│       └── src/
│           ├── main.tsx            # React DOM root + providers
│           ├── App.tsx             # Route definitions + auth guards
│           ├── api/
│           │   └── client.ts       # Axios + Clerk JWT interceptor
│           ├── hooks/              # useAnalysis, useAnalysisStatus, useSocket
│           ├── pages/              # 9 page components
│           ├── components/         # 10 component directories
│           └── types/
│               └── index.ts        # Shared TypeScript interfaces
```

---

## Technology Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Express v5** | HTTP API framework |
| **TypeScript v6** | Type-safe server code (CommonJS output) |
| **PostgreSQL** (Neon serverless) | Primary database |
| **Drizzle ORM** | Type-safe queries, schema definitions, migrations |
| **BullMQ** | Background job queue (analysis pipeline) |
| **Redis** (Upstash) | BullMQ transport + job persistence |
| **Socket.io** | Real-time WebSocket events |
| **Clerk** | Authentication + multi-tenant org management |
| **OpenRouter** | LLM API gateway (risk event analysis) |
| **Serper** | Google News search API (RAG context for LLM) |
| **OpenWeatherMap** | Current weather + 5-day forecast |
| **OpenCage** | Geocoding (address → lat/lng) |
| **node-cron** | Scheduled nightly re-analysis |
| **Pino** | Structured JSON logging |
| **Zod** | Runtime schema validation |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React v19** | UI framework |
| **Vite v8** | Build tool + dev server |
| **TypeScript v6** | Type-safe frontend code |
| **TailwindCSS v3** | Utility-first CSS |
| **shadcn/ui** (Radix primitives) | Accessible component library |
| **TanStack React Query v5** | Server state + cache management |
| **React Hook Form + Zod** | Form validation |
| **Recharts** | Dashboard charts (risk trends, events) |
| **Socket.io Client** | Real-time event subscriptions |
| **Clerk React** | Auth UI components + org switching |
| **Sonner** | Toast notifications |
| **Lucide React** | Icon library |

---

## Backend Architecture

### Entry Point

[`server.ts`](apps/backend/src/server.ts) bootstraps the entire backend:

1. Creates Express app + HTTP server
2. Attaches CORS (restricted to `FRONTEND_URL`), JSON parsing, Clerk middleware, and Pino HTTP logging
3. Mounts 7 API routers under `/api/*`
4. Registers 404 handler, auth error handler, and global error handler
5. Initializes Socket.io on the HTTP server
6. Starts node-cron scheduled jobs
7. Imports the analysis worker module during app startup, which creates the BullMQ worker
8. Listens on `PORT` with graceful `SIGINT`/`SIGTERM` shutdown

### Database Layer

**Connection** ([`drizzle.ts`](apps/backend/src/database/drizzle.ts)): Uses `@neondatabase/serverless` pool with `drizzle-orm` for type-safe SQL.

**Schema** ([`schema.ts`](apps/backend/src/database/schema.ts)): 9 core tables. Tenant-owned tables carry `organizationId`; the `supplier_export_ports` junction table inherits tenant scope through its supplier and port foreign keys.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `ports` | Maritime ports with coordinates | Unique on (name, country, org) |
| `warehouses` | Inventory destinations | FK → `ports.id` (import port) |
| `suppliers` | Supplier profiles + current risk scores | Indexed on (org, riskLevel) |
| `supplier_export_ports` | Many-to-many supplier ↔ port mapping | FK → suppliers, FK → ports, `isPrimary` baseline route flag |
| `route_scores` | Permutative route scoring records | Unique on (supplier, export, import, warehouse) |
| `recommendations` | Alternative route suggestions | JSONB ranked lists for ports/warehouses |
| `risk_events` | LLM-sourced risk events | Typed as financial/labor/geopolitical/logistics/esg |
| `supplier_score_history` | Longitudinal risk scores + forecasts | Unique on (supplier, date, isForecast) |
| `alerts` | Dynamic risk warnings | Indexed on (org, isDismissed) |

**Multi-tenancy**: `ports`, `warehouses`, `suppliers`, `route_scores`, `recommendations`, `risk_events`, `supplier_score_history`, and `alerts` store `organizationId` from Clerk's external org system. `supplier_export_ports` is scoped indirectly through its related supplier and port. No dedicated organizations table exists — Clerk manages org lifecycle.

### Service Layer

Six service modules abstract database CRUD:

- **`supplier.service.ts`** — Create, read, update, delete suppliers + export port management
- **`port.service.ts`** — Port CRUD + geocoding via OpenCage
- **`warehouse.service.ts`** — Warehouse CRUD with import port linking
- **`alert.service.ts`** — Create alerts, dismiss single/bulk, fetch with filters
- **`recommendation.service.ts`** — Create recommendations, accept/dismiss
- **`scoreHistory.service.ts`** — Upsert daily scores using `onConflictDoUpdate`

### REST API Routes

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| `health` | `/api/health` | `GET /` — server health check |
| `suppliers` | `/api/suppliers` | CRUD + `GET /:id/history` + `GET /:id/events` |
| `warehouses` | `/api/warehouses` | CRUD with import port management |
| `ports` | `/api/ports` | CRUD with auto-geocoding |
| `analysis` | `/api/analysis` | `POST /run` (triggers BullMQ job), `GET /routes/:supplierId` (DB read) |
| `alerts` | `/api/alerts` | List + dismiss single/bulk |
| `recommendations` | `/api/recommendations` | List + accept/dismiss |

### Authentication & Middleware

[`auth.ts`](apps/backend/src/middleware/auth.ts):
- `requireAuth()` — Verifies the Clerk session has a `userId`
- `getOrgId(req)` — Reads the active Clerk `orgId` for tenant scoping
- `getUserId(req)` — Reads the authenticated Clerk `userId`
- `handleAuthError()` — Returns 401 for invalid/missing auth or missing active organization

---

## Risk Analysis Engine

### Event Risk (Serper + OpenRouter)

[`serperSearch.ts`](apps/backend/src/risk/serperSearch.ts) → [`eventRisk.ts`](apps/backend/src/risk/eventRisk.ts)

**Two-path approach (RAG with fallback):**

1. **Serper path (preferred):** Searches Google News via Serper API for recent articles about the supplier (last 7 days). Articles are formatted into a text block and injected into the [`riskAnalysis.txt`](apps/backend/src/risk/prompts/riskAnalysis.txt) prompt template. The LLM then analyzes *real articles* rather than relying on training data.

2. **Fallback path:** If Serper is unavailable or returns no results, uses [`riskAnalysisFallback.txt`](apps/backend/src/risk/prompts/riskAnalysisFallback.txt) which asks the LLM to use its general knowledge of ongoing global events.

**LLM Processing:**
- Sends prompt to OpenRouter API (configurable model, default: `google/gemma-4-31b-it:free`)
- Strips `<think>` tags and markdown code fences from response
- Validates and normalizes the JSON output
- Handles 429 rate limits with exponential backoff (max 2 retries, 4-minute cooldown)
- Graceful degradation: returns score 0 if LLM fails

**Scoring:**
- Worst event per category determines category score
- Categories weighted: Financial (30%), Geopolitical (25%), Labor (20%), Logistics (15%), ESG (10%)
- Final score: 0–100

### Weather Risk (OpenWeatherMap)

[`weatherRisk.ts`](apps/backend/src/risk/weatherRisk.ts)

**Current weather:** Evaluates 4 points on the route (supplier origin, export port, import port, warehouse). The highest-risk location determines the route score.

**Weather severity mapping:**

| Condition | Severity |
|-----------|----------|
| Clear | 0.0 |
| Clouds | 0.1 |
| Rain | 0.3 |
| Snow | 0.4 |
| Thunderstorm | 0.6 |
| Tornado | 1.0 |

**5-day forecast:** Collapses OWM's 3-hour intervals into daily worst-case conditions across all 4 route points.

### Operational Risk (Haversine)

[`operationalRisk.ts`](apps/backend/src/risk/operationalRisk.ts)

Calculates logistics risk using Haversine great-circle distance across 3 legs:
- **Leg 1:** Supplier → Export Port (~250 km/day road)
- **Leg 2:** Export Port → Import Port (~400 km/day sea)
- **Leg 3:** Import Port → Warehouse (~250 km/day road)

Weighted factors:
- Route distance severity (30%)
- Total delivery time severity (30%)
- Supplier dependency concentration (40%)

Also computes: total distance (km), transit days, total delivery days, estimated cost (USD).

### Combined Risk Score

```
Final = Event × 0.5 + Operational × 0.3 + Weather × 0.2
```

| Level | Score Range | Meaning |
|-------|-------------|---------|
| Low | 0–29 | Minimal concerns |
| Medium | 30–54 | Worth monitoring |
| High | 55–74 | Alternative routing recommended |
| Critical | 75–100 | Immediate action required |

### Route Scorer

[`routeScorer.ts`](apps/backend/src/risk/routeScorer.ts)

Generates and scores every valid route permutation: `Supplier → Export Port → Import Port → Warehouse`

- Loads supplier export ports and organization warehouses
- For each combination, calculates operational risk and route-specific weather
- Caches weather results per (exportPort, warehouse) pair to avoid API spam
- Combines all three risk dimensions into a total score
- Sorts results by: risk score → delivery time → cost

### Smart Router (Recommendations)

[`smartRouter.ts`](apps/backend/src/risk/smartRouter.ts)

Identifies the best alternative route and generates a recommendation:
- Compares best route score against current (primary) route
- Only recommends if improvement ≥ 10 points
- Ranks export ports, import ports, and warehouses independently
- Generates human-readable reason strings

---

## Analysis Pipeline — End to End

When a user clicks **"Run Analysis"** or the midnight CRON fires, this 15-step pipeline executes:

```
Step  1:  Load supplier from DB
Step  1b: Purge score history and risk events older than today
Step  2:  Run event risk (Serper → LLM) + current weather in parallel
Step  3:  Score all route combinations (operational + weather per route)
Step  4:  Compute today's combined score using primary route
Step  5:  Run 5-day weather forecast
Step  6:  Build forecast score rows (Day 2–5)
Step  7:  Find best alternative route (smart router)
Step  8:  Upsert today's actual score history
Step  9:  Upsert forecast score history (Day 2–5)
Step 10:  Update supplier current scores in DB
Step 11:  Upsert route scores (onConflictDoUpdate)
Step 12:  Insert new risk events
Step 13:  Save recommendation if improvement ≥ 10 points
Step 14:  Create alert if risk is high or critical
Step 15:  Emit real-time Socket.io events
```

When a user clicks **"Show Analysis"**, only a `GET /api/analysis/routes/:supplierId` database read occurs — no worker, no queue, instant results.

---

## Real-Time Updates (Socket.io)

**Server** ([`socket/index.ts`](apps/backend/src/socket/index.ts)):
- Clients join organization rooms via `join:org` event
- `emitToOrg(orgId, event, data)` broadcasts to all org members

**Events:**

| Event | Trigger | Frontend Effect |
|-------|---------|-----------------|
| `analysis:started` | Worker begins processing | Shows loading spinners |
| `risk:update` | Analysis completes | Invalidates suppliers, history, events, routes, recommendations |
| `recommendation:new` | New alternative found | Invalidates recommendations |
| `alert:new` | Risk exceeds threshold | Invalidates alerts |

**Client** ([`useSocket.ts`](apps/frontend/src/hooks/useSocket.ts)):
- Connects on mount, joins org room
- Subscribes to all 4 events
- Uses `useAnalysisStatus` external store for cross-component state

---

## Background Workers & Scheduling

**BullMQ Queue** ([`queue.ts`](apps/backend/src/queues/queue.ts)):
- Queue name: `supplier-analysis`, prefix: `hermes`
- 3 retry attempts with exponential backoff (5s base)
- Keeps 100 completed / 50 failed jobs for debugging
- Connects to Upstash Redis with TLS

**Worker** ([`analysis-worker.ts`](apps/backend/src/workers/analysis-worker.ts)):
- Concurrency: 1 (sequential processing to respect API rate limits)
- Executes the full 15-step pipeline per job

**Scheduler** ([`schedule.ts`](apps/backend/src/jobs/schedule.ts)):
- Runs at midnight UTC daily (`0 0 * * *`)
- Iterates all suppliers across all organizations
- Queues one analysis job per supplier

---

## Frontend Architecture

### Routing & Auth

[`App.tsx`](apps/frontend/src/App.tsx) defines the routing tree:

```
/sign-in, /sign-up → Public Clerk auth pages
/onboarding        → RequireAuth only (no org needed)
/                  → ProtectedRoute (auth + org required)
  ├── /            → Dashboard
  ├── /suppliers   → Supplier management
  ├── /warehouses  → Warehouse management
  ├── /ports       → Port management
  ├── /analysis    → Route analysis workspace
  └── /alerts      → Alert panel
```

`ProtectedRoute` checks both auth state and organization membership. If no org exists, redirects to `/onboarding`.

`SocketWrapper` initializes the WebSocket connection for all protected routes.

### Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Summary cards (suppliers, critical, high, recommendations), risk trend chart, risk event chart, inline run-analysis button |
| **Suppliers** | Supplier list with risk badges, detail view with score card + historical trend chart, supplier form with export port management |
| **Warehouses** | Warehouse list + form with import port selection |
| **Ports** | Port list + form with auto-geocoding |
| **Analysis** | Two-button interface (Run Analysis ▶ / Show Analysis 👁), route score table, priority panel with recommendation |
| **Alerts** | Alert list with dismiss single/bulk actions |

### Hooks

| Hook | Purpose |
|------|---------|
| `useAnalysis` | `useMutation` wrapper for `POST /api/analysis/run` |
| `useAnalysisStatus` | Lightweight external store tracking which suppliers are being analyzed (cross-component state without context) |
| `useSocket` | Socket.io connection + React Query cache invalidation on events |

### Components

| Directory | Key Components |
|-----------|---------------|
| `analysis/` | `AnalysisTrigger` (run/show buttons), `RouteScoreTable`, `PriorityPanel` |
| `alerts/` | `AlertBanner` (dismissible alert bar on dashboard) |
| `cards/` | `SummaryCard` (metric card with icon) |
| `charts/` | `RiskTrendChart` (line chart), `RiskEventChart` (bar chart) |
| `layout/` | `AppLayout` (sidebar navigation, org switcher) |
| `shared/` | `PageHeader`, `LoadingSpinner`, `RiskBadge` |
| `suppliers/` | `SupplierForm`, `SupplierDetail`, `RiskScoreCard` |
| `ports/` | `PortForm` |
| `warehouses/` | `WarehouseForm` |

---

## Data Flow Diagrams

### Run Analysis (Full Pipeline)

```
User clicks "Run Analysis"
       │
       ▼
Frontend ──POST /api/analysis/run──→ Express Router
       │                                    │
       │                            Enqueue BullMQ Job
       │                                    │
       ▼                                    ▼
Socket.io ◄──analysis:started───── BullMQ Worker
       │                                    │
       │                    ┌───────────────┼───────────────┐
       │                    │               │               │
       │              Serper Search   OpenWeatherMap   Haversine Calc
       │              → OpenRouter       (4 points)    (3 legs × N routes)
       │                    │               │               │
       │                    └───────────────┼───────────────┘
       │                                    │
       │                           Combined Scoring
       │                                    │
       │                    ┌───────────────┼───────────────┐
       │                    │               │               │
       │               Route Scores    Risk Events     Score History
       │               (upsert)        (insert)        (upsert)
       │                    │               │               │
       │                    └───────────────┼───────────────┘
       │                                    │
       │                         Recommendation + Alert
       │                                    │
       ▼                                    ▼
Socket.io ◄──risk:update──────────── Worker Complete
       │
       ▼
React Query cache invalidated → UI refreshes
```

### Show Analysis (DB Read Only)

```
User clicks "Show Analysis"
       │
       ▼
Frontend ──GET /api/analysis/routes/:id──→ Express Router
                                                 │
                                          DB SELECT query
                                                 │
                                                 ▼
                                          JSON response
                                                 │
                                                 ▼
                                     React Query caches result
                                                 │
                                                 ▼
                                          UI renders table
```

---

## Deployment

### Recommended Architecture

```
┌─────────────────────────────────────────┐
│       Render Static Site (Frontend)     │
│          React + Vite static build      │
└──────────────────┬──────────────────────┘
                   │ HTTP + WebSocket
                   ▼
┌─────────────────────────────────────────┐
│        Render Web Service (Backend)     │
│   Express + BullMQ + Socket.io + CRON  │
└───────┬─────────────────┬───────────────┘
        │                 │
        ▼                 ▼
   ┌─────────┐      ┌──────────┐
   │   Neon  │      │ Upstash  │
   │PostgreSQL│     │  Redis   │
   └─────────┘      └──────────┘
```

### Backend (Render Web Service)
- **Root Directory:** `apps/backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node dist/server.js`
- **Runtime:** Node.js

### Frontend (Render Static Site)
- **Root Directory:** `apps/frontend`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Redirect Rule:** `/* → /index.html` (Rewrite) for SPA routing

---

## Environment Variables

### Backend (`apps/backend/.env`)

```env
PORT=3001
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
UPSTASH_REDIS_URL=redis://default:password@hostname:6379
CLERK_SECRET_KEY=sk_test_xxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxx
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=google/gemma-4-31b-it:free
OPENWEATHERMAP_API_KEY=xxxx
OPENCAGE_API_KEY=xxxx
SERPER_API_KEY=xxxx
WEBSITE=https://hermes-supply-chain.app
FRONTEND_URL=http://localhost:5173
```

### Frontend (`apps/frontend/.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
```

---

## Key Design Decisions

1. **CommonJS build target** — Changed from ESNext modules to CommonJS (`"type": "commonjs"`) to avoid `__dirname` issues in production builds. The `prompts/` directory is copied to `dist/` during build.

2. **Type packages in dependencies** — `@types/express`, `@types/cors`, `@types/node`, and `typescript` are in `dependencies` (not `devDependencies`) so Render's production `npm install` includes them for the `tsc` build step.

3. **Serper + LLM RAG pattern** — Rather than relying purely on LLM training data (which may be stale), the system first searches for real news articles and feeds them to the LLM as context. Falls back to knowledge-based analysis when Serper is unavailable.

4. **Two-button analysis interface** — "Run Analysis" triggers the full BullMQ pipeline; "Show Analysis" does a direct DB read. This prevents accidental re-runs when navigating to the analysis page.

5. **`useSyncExternalStore` for analysis status** — A lightweight module-level store (no React Context) tracks which suppliers are being analyzed, enabling cross-component state without prop drilling.

6. **`onConflictDoUpdate` for route scores** — Uses PostgreSQL upserts on the unique constraint `(supplier, exportPort, importPort, warehouse)` instead of N+1 check-then-insert queries.

7. **Weather cache in route scorer** — Caches weather results per `(exportPort, warehouse)` key during a single analysis run to avoid redundant API calls.

8. **Organization-scoped everything** — Every database table includes `organizationId`. Socket.io rooms are org-scoped. API middleware injects org context from Clerk JWT.

9. **Graceful degradation** — If the LLM provider fails, event risk returns 0 and analysis continues. If weather API fails for a point, it defaults to score 10. The system is designed to always complete rather than crash.
