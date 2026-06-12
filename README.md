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
- **Live Alerts via Socket.io:** Immediate visual alerts when a route's risk level climbs to High or Critical.
- **Background Analysis Workers:** Redis-backed BullMQ processors running event and weather scorers.
- **Automatic Recommendation Generation:** System triggers new recommendations when alternative options outperform the baseline by 10+ points.
- **Nightly Scheduled Analysis:** Automated midnight CRON job re-analyzes all suppliers across all organizations daily.

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
- React Hook Form + Zod (form validation)
- Recharts
- Sonner (toast notifications)
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
- Zod (schema validation)
- OpenRouter (LLM integration)
- OpenWeatherMap API
- OpenCage Geocoding API
- node-cron (scheduled jobs)
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

Calculated using Haversine distance across three route legs:
- **Leg 1:** Supplier Origin → Export Port (road, ~250 km/day)
- **Leg 2:** Export Port → Import Port (sea, ~400 km/day)
- **Leg 3:** Import Port → Warehouse (road, ~250 km/day)

Weighted factors:
- Route distance severity (30%)
- Total delivery time severity (30%)
- Supplier dependency concentration (40%)

### Combined Risk Score

Final supplier score = `Event × 0.5 + Operational × 0.3 + Weather × 0.2`

Classification thresholds:
- **Low (0–29):** Minimal operational or environmental concerns.
- **Medium (30–54):** Minor weather/event anomalies, worth monitoring.
- **High (55–74):** High delays or cost impacts expected; alternative routing recommended.
- **Critical (75–100):** Disruption active or highly imminent; immediate action required.

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

1. **User triggers analysis** (or midnight CRON fires): Request pushed to Express router.
2. **BullMQ job created:** Job added to `supplier-analysis` queue with prefix `hermes`.
3. **Stale data purged:** Previous score history and risk events are deleted for a clean slate.
4. **`analysis:started` emitted:** Frontend receives socket event and shows loading spinners.
5. **Event risk fetched:** LLM queries OpenRouter API for risk events and parses structured JSON.
6. **Weather risk calculated:** Four-point coordinates query OpenWeatherMap API for conditions.
7. **Route combinations scored:** Haversine distance calculations across all permitted legs.
8. **5-day weather forecast scored:** Future weather projections per route location.
9. **Recommendations generated:** Identifies if secondary combinations offer 10+ point score upgrades.
10. **Alerts generated:** Triggers high-priority warnings if risk thresholds are crossed.
11. **`risk:update` broadcasted:** Socket.io emits completion event to all organization sessions.
12. **Frontend refreshes automatically:** React Query cache is invalidated, refreshing UI tables/charts.

---

## Database Design
![ERDiagram](/apps/frontend/public/screenshots/erdiagram.png)
### Core Tables
- **Suppliers:** Supplier metadata, risk levels, categories, and name aliases.
- **Ports:** Maritime import/export port coordinates (auto-geocoded via OpenCage).
- **Warehouses:** Inventory destinations with geocoded coordinates.
- **Supplier Export Ports:** Junction table defining supplier-to-port shipment mappings.
- **Supplier Score History:** Longitudinal record of supplier risk scores over time.
- **Risk Events:** LLM-sourced risk events with type, severity, headline, source, and summary.
- **Route Scores:** Permutative route distance, cost, and risk scoring records.
- **Recommendations:** Actionable alternative route suggestions (accept/dismiss).
- **Alerts:** Dynamic warning logs with dismiss (single & bulk) support.

Organization IDs are stored as text columns referencing Clerk's external org system — no dedicated organizations table.

---

## Real-Time Updates

Socket.io channels:
- `analysis:started` — Emitted when analysis begins; frontend shows loading spinners.
- `risk:update` — Emitted when a new analysis completes; triggers data refresh.
- `recommendation:new` — Broadcasted when a new alternate configuration is available.
- `alert:new` — Fired when a supplier breaches High or Critical risk thresholds.

All updates are scoped by organization ID to ensure tenant data isolation.

---

## Screenshots

*Note: Replace these placeholders with your actual application screenshots once the frontend builds.*

### 1. User Authentication (Sign In & Sign Up)
![Sign In](/apps/frontend/public/screenshots/signin.png)
![Sign Up](/apps/frontend/public/screenshots/signup.png)
*Secures access to the platform using Clerk, supporting multi-tenant organization flows and account switching.*

### 2. Onboarding
![Onboarding](/apps/frontend/public/screenshots/onboarding.png)
*Guides new users through Clerk-based organization creation, then redirects to the dashboard to begin adding suppliers, ports, and warehouses.*

### 3. Executive Dashboard
![Executive Dashboard](/apps/frontend/public/screenshots/dashboard.png)
*Provides a high-level overview of supplier risk distributions, active recommendations count, active warnings, and interactive risk event severity bar charts.*

### 4. Supplier Management (List & Detail View)
![Supplier Detail](/apps/frontend/public/screenshots/supplierDetail.png)
*Manage supplier profiles, configure many-to-many export ports, and inspect historical risk scoring trend charts.*

### 5. Warehouse Inventory Hub
![Warehouses](/apps/frontend/public/screenshots/warehouses.png)
*Displays a list of active warehouses, and associated primary import ports.*

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

## Future Aspects & Roadmap

Hermes is built to grow into a predictive, AI-driven supply chain assistant. Planned improvements that naturally extend the current architecture:

### 1. Web-Search-Enabled LLM Upgrade
- **Real-Time News Scanning:** Switch from a static-knowledge LLM to a web-search-capable model (e.g., Perplexity Sonar) so risk events are sourced from live, verifiable news articles rather than training data.
- **Source URL Validation:** Add a backend step that HTTP-HEAD-checks source URLs before storing, filtering out any hallucinated links.

### 2. Historical Trend Analysis
- **Score Accumulation Over Time:** Retain historical score data across runs instead of purging, enabling month-over-month risk trend comparisons and seasonal pattern detection.
- **Supplier Reliability Index:** Compute a rolling 30/60/90-day reliability score from historical data to identify chronically risky suppliers.

### 3. Email & Webhook Notifications
- **Critical Alert Emails:** Send automated email digests when a supplier crosses critical risk thresholds, so stakeholders don't need to monitor the dashboard live.
- **Webhook Integration:** Expose configurable webhook endpoints for downstream ERP or logistics management system integration.

### 4. Port Congestion & AIS Vessel Tracking
- **Live Port Congestion Data:** Integrate real-time port congestion APIs to factor actual queue wait times into route scoring.
- **AIS Vessel Tracking:** Pull Automatic Identification System data for in-transit visibility on active shipments.

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
OPENROUTER_MODEL=google/gemma-4-31b-it:free
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

---

## License

This project is licensed under the MIT License:

```
MIT License

Copyright (c) 2026 Somesh Gorai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
