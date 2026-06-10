# Hermes
Supply Chain Risk Intelligence & Route Optimization Platform

## Overview
Hermes is an enterprise-grade supply chain intelligence platform that continuously monitors supplier risk, weather disruptions, geopolitical events, and operational bottlenecks to proactively recommend safer logistics routes.

---

## Problem Statement
Global logistics networks are highly vulnerable to volatile disruptions. Events like labor strikes at a critical port, severe tropical storms, regional border blockades, or a supplier's financial collapse can cause delays that cost millions. Currently, supply chain operators rely on fragmented datasets and reactive decision-making, leaving them blind to risk changes on secondary transit legs and forcing them to guess alternative routes.

---

## Solution
Hermes bridges the gap between risk intelligence and execution. By orchestrating automated weather monitoring, LLM-based news parsing, and multi-leg transit metrics, Hermes computes dynamic risk scores for every supplier route combination. When a route exceeds acceptable risk tolerances, the system suggests alternative routes that are pre-calculated for distance, cost, and time efficiency.

---

## Key Features

### Supplier Risk Intelligence
- **Real-time Supplier Monitoring:** Automated background checks for supplier country stability and operational indicators.
- **Risk Scoring (0–100):** Normalized scoring systems representing real-time vulnerabilities.
- **Historical Risk Trends:** Performance history trackers to assess long-term supplier stability.
- **Forecast Projections:** 5-day risk trend forecasts based on current weather trajectories.

### Route Optimization
- **Supplier → Export Port → Import Port → Warehouse Analysis:** Permutative scoring across all connected ports and destination warehouses.
- **Multi-Route Comparison:** Comparison grids showing total cost, distance, transit days, and risk indices.
- **Alternative Route Recommendations:** Automatic calculation of secondary routes when primary routes are compromised.
- **Cost and Transit-Time Evaluation:** Trade-off analysis showing the financial and timing impact of changing ports.

### Real-Time Monitoring
- **Live Alerts via Socket.io:** Immediate visual alerts when a route's risk level climbs to Critical.
- **Background Analysis Workers:** Redis-backed BullMQ processors running event and weather scorers.
- **Automatic Recommendation Generation:** System triggers new recommendations when alternative options outperform the baseline by 10+ points.

### Organization Management
- **Multi-Tenant Architecture:** Secure workspace isolation for multiple customer organizations.
- **Clerk Authentication:** Seamless logins, sign-ups, and organization-scoped routing.
- **Organization Isolation:** Databases and worker channels scoped strictly by organization ID.

---

## System Architecture

```
Frontend (React + Vite)
        |
        v
Express API
        |
        +---- PostgreSQL (Drizzle ORM)
        |
        +---- Redis / BullMQ
                    |
                    v
            Analysis Worker
                    |
      +-------------+-------------+
      |                           |
 Event Risk                Weather Risk
 (OpenRouter)          (OpenWeatherMap)
      |                           |
      +-------------+-------------+
                    |
             Route Scoring
                    |
      Recommendations & Alerts
                    |
                Socket.io
                    |
                 Frontend
```

---

## Technology Stack

### Frontend
- React (v19)
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- React Query (TanStack Query)
- Recharts
- Clerk React

### Backend
- Node.js
- Express
- TypeScript
- PostgreSQL
- Drizzle ORM
- BullMQ
- Redis (Upstash / local)
- Socket.io
- OpenRouter (LLM integration)
- OpenWeatherMap API
- Pino Logger

---

## Risk Analysis Engine

### Event Risk (0–100)

OpenRouter analyzes supplier-specific news events and categorizes risks into:

| Category | Weight |
|----------|----------|
| Financial | 30% |
| Geopolitical | 25% |
| Labor | 20% |
| Logistics | 15% |
| ESG | 10% |

### Weather Risk (0–100)

Current weather is evaluated at:
- Supplier Origin
- Export Port
- Import Port
- Destination Warehouse

The highest-risk point determines the route weather score.

### Operational Risk (0–100)

Calculated using:
- Supplier dependency level
- Lead time
- Route distance
- Transit duration
- Shipping cost factors

### Combined Risk Score

Combined score generates a categorical risk classification:
- **Low:** Minimal operational or environmental concerns.
- **Medium:** Minor weather/event anomalies, worth monitoring.
- **High:** High delays or cost impacts expected; alternative routing recommended.
- **Critical:** Disruption active or highly imminent; immediate action required.

---

## Route Optimization

Every valid route combination is evaluated:

```
Supplier ──> Export Port ──> Import Port ──> Warehouse
```

Routes are ranked by:
1. Lowest risk score
2. Lowest delivery time
3. Lowest cost

---

## Analysis Pipeline

1. **User triggers analysis:** Client dispatch pushes request to Express router.
2. **BullMQ job created:** Job added to `supplier-analysis` queue with prefix `hermes`.
3. **Analysis worker consumes job:** Worker pulls job payload and starts parallel threads.
4. **Event risk fetched:** Scanner queries OpenRouter API for recent news and parses event JSON.
5. **Weather risk calculated:** Port coordinates query OpenWeatherMap API for storm activity.
6. **Route combinations scored:** The engine runs calculations across all permitted legs.
7. **Recommendations generated:** Identifies if secondary combinations offer 10+ point score upgrades.
8. **Alerts generated:** Triggers high-priority warnings if risk thresholds are crossed.
9. **Socket.io broadcasts updates:** Emits updates to all active sessions in the organization room.
10. **Frontend refreshes automatically:** React Query cache is invalidated, refreshing UI tables/charts.

---

## Database Design
![ERDiagram](/apps/frontend/public/screenshots/erdiagram.png)
### Core Tables
- **Organizations:** Clerk tenant mappings.
- **Suppliers:** Supplier metadata, risk levels, and categories.
- **Ports:** Maritime import/export port coordinates.
- **Warehouses:** Inventory destinations.
- **Supplier Export Ports:** Junction table defining supplier shipment mappings.
- **Supplier Score History:** Longitudinal record of supplier risks over time.
- **Route Scores:** Permutative route distance, cost, and risk scoring records.
- **Recommendations:** Actionable alternative options.
- **Alerts:** Dynamic warning logs.

---

## Real-Time Updates

Socket.io channels:
- `risk:update` — Emitted when a new analysis completes.
- `recommendation:new` — Broadcasted when a new alternate configuration is available.
- `alert:new` — Fired when a supplier breaches Critical risk thresholds.

All updates are scoped by organization ID to ensure tenant data isolation.

---

## Screenshots

*Note: Replace these placeholders with your actual application screenshots once the frontend builds.*

### 1. User Authentication (Sign In & Sign Up)
![Sign In](/apps/frontend/public/screenshots/signin.png)
![Sign Up](/apps/frontend/public/screenshots/signup.png)
*Secures access to the platform using Clerk, supporting multi-tenant organization flows and account switching.*

### 2. Onboarding Setup Wizard
![Onboarding](/apps/frontend/public/screenshots/onboarding.png)
*A multi-step configuration wizard guiding new organizations through setting up their initial supplier profiles, port connections, and warehouses.*

### 3. Executive Dashboard
![Executive Dashboard](/apps/frontend/public/screenshots/dashboard.png)
*Provides a high-level overview of supplier risk distributions, active recommendations count, active warnings, and interactive risk event severity bar charts.*

### 4. Supplier Management (List & Detail View)
![Supplier Detail](/apps/frontend/public/screenshots/supplierDetail.png)
*Manage supplier profiles, configure many-to-many export ports, and inspect historical risk scoring trend charts.*

### 5. Warehouse Inventory Hub
![Warehouses](/apps/frontend/public/screenshots/warehouses.png)
*Displays a list of active warehouses, their current risk exposures, and associated primary import ports.*

### 6. Port Infrastructure Hub
![Ports](/apps/frontend/public/screenshots/ports.png)
*Lists maritime ports along with dynamic geolocation data (latitude/longitude) and regional designations.*

### 7. Route Analysis Workspace
![Route Analysis1](/apps/frontend/public/screenshots/analysis1.png)
![Route Analysis2](/apps/frontend/public/screenshots/analysis2.png)
*Compare all possible route combinations dynamically. Features a recommended route card detailing differences in cost, distance, and transit time.*

### 8. Real-time Alerts Panel
![Alerts](/apps/frontend/public/screenshots/alerts.png)
*Monitors and displays high-priority risk warnings broadcasted dynamically via Socket.io when weather or geopolitical events threaten supplier operations.*

---

## Environment Variables

### Backend

Create a `.env` file in `apps/backend/`:

```env
PORT=3001
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
UPSTASH_REDIS_URL=redis://default:password@hostname:6379
CLERK_SECRET_KEY=sk_test_xxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxx
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=openrouter/free
OPENWEATHERMAP_API_KEY=xxxx
OPENCAGE_API_KEY=xxxx
WEBSITE=https://hermes-supply-chain.app
FRONTEND_URL=http://localhost:5173
```

### Frontend

Create a `.env` file in `apps/frontend/`:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
```
