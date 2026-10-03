# Performa — Performance Evaluation

**Date:** 2026-10-03 · **Scope:** backend API latency, database/query efficiency, frontend bundle & load, caching, and applied optimizations.
**Method:** live HTTP timing (local), production build inspection (`vite build`), static query/index review, browser navigation timing.

> **Environment note:** backend timings were measured locally against SQLite (`sqlite+aiosqlite`) on a single uvicorn process — not production-representative (Postgres + workers will differ, but the async/query design carries over). Bundle sizes are from the production build.

---

## 1. Backend API latency (local, n=5 per endpoint)

| Endpoint | Avg | Min | Max |
|---|---|---|---|
| `GET /health` | 9.4 ms | 8 | 14 |
| `GET /api/employees/` | 12.8 ms | 12 | 14 |
| `GET /api/employees/milestones` | 12.6 ms | 12 | 14 |
| `GET /api/interventions/pending` | 10.4 ms | 10 | 11 |
| `GET /api/evaluations/{id}/scorecard` | 13.2 ms | 13 | 14 |
| `GET /api/evaluations/{id}/trend` | 12.6 ms | 12 | 13 |
| `GET /api/admin/activity?limit=200` | 11.2 ms | 4 | 39 |

**All endpoints respond in ~10–13 ms** locally — well within interactive budgets. The async FastAPI + SQLAlchemy 2.0 stack keeps I/O non-blocking.

## 2. Query & database efficiency

- **N+1 elimination:** `selectinload` eager-loading is used in **10** query sites (e.g., employee detail loads `user`, `employer`, `supervisor` in one round-trip instead of per-row queries).
- **Indexes:** **20** indexed columns plus FK indexes; unique constraints on `users.email`, `organizations.name/slug`, `monthly_summaries(employee_id, month_number)`, `kpi_rubrics(organization_id, competency)`.
- **Tenant scoping:** every query filters `organization_id` (indexed) → small result sets per tenant.
- **Pagination:** audit-trail and activity endpoints support `skip`/`limit`; the Audit Trail UI paginates client-side (25/page).

## 3. AI/ML pipeline

- **Model load:** the Random Forest (`rf_model.joblib`, 330 KB) is loaded **lazily and cached** (`lru_cache`) → one load per process, not per request.
- **Inference:** in-memory `predict_proba` over a 5-feature vector → sub-millisecond.
- **Gemini:** called via an **async** client with a **10 s timeout** and graceful fallback; it never blocks the event loop. External API latency dominates rollup/regularization (not measured here).

## 4. Frontend bundle — before vs. after code splitting

### Before (single chunk)
| Asset | Raw | Gzip |
|---|---|---|
| `index.js` (entire app) | 473.66 KB | 129.91 KB |
| `index.css` | 41.86 KB | 7.80 KB |

### After (route-level code splitting + vendor chunks)
| Chunk | Raw | Gzip |
|---|---|---|
| `index.js` (app core + router) | 69.84 KB | 25.45 KB |
| `vendor-react` (react, react-dom, react-router-dom) | 164.46 KB | 53.65 KB |
| `vendor-tanstack` | 41.57 KB | 12.54 KB |
| `vendor-ui` (lucide) | 22.85 KB | 4.62 KB |
| `Login` (route chunk) | 6.01 KB | 2.01 KB |
| `index.css` | 41.86 KB | 7.80 KB |

**Initial login payload:** ~305 KB raw / **~98 KB gzip** (core + vendors + login chunk), vs. the previous 474 KB raw / 130 KB gzip for the whole app — a **~36 % raw / ~25 % gzip reduction**, and route navigation now fetches only the page chunk.

### Per-route chunks (loaded on demand)
| Route | Raw | Gzip |
|---|---|---|
| Dashboard | 10.70 KB | 2.94 KB |
| Employees | 21.88 KB | 5.51 KB |
| Employee Detail | 22.84 KB | 6.37 KB |
| AppShell | 19.22 KB | 5.54 KB |
| Settings | 15.53 KB | 3.77 KB |
| User Management | 16.86 KB | 4.10 KB |
| Rate Employee | 13.11 KB | 4.25 KB |
| Rollups | 11.60 KB | 3.53 KB |
| Employee Dashboard | 9.78 KB | 2.89 KB |
| Audit Trail | 9.13 KB | 3.02 KB |
| Rubrics | 7.14 KB | 2.72 KB |
| Supervisor Dashboard | 5.65 KB | 1.80 KB |
| Employee Training / Notifications / Activity Log | 3.2–3.6 KB | 1.2–1.4 KB |
| Shared primitives (Button, Badge, StatusDot, MilestonePill, ScoreMeter) | 0.87–1.34 KB | 0.5–0.7 KB |

Vendor chunks (`vendor-react`, `vendor-tanstack`, `vendor-ui`) are **content-hashed** → cached long-term across deploys; only changed chunks are re-downloaded.

## 5. Fonts

- **IBM Plex Sans + IBM Plex Mono**, **latin-only** subsets, weights 400/500/600/700 → **8 woff2** files (~24 KB each), `font-display: swap`, loaded lazily by `unicode-range`. Built CSS remains ~42 KB (7.8 KB gzip).

## 6. Client data caching

- **TanStack Query:** `staleTime` 2 min, `retry` skips 4xx, `refetchOnWindowFocus: false` → minimal redundant refetches; query cache is **cleared on logout/401** to prevent cross-role bleed.
- **Avatars** are CSS-rendered initials → **zero image payloads**.

## 7. Optimizations applied (this pass)
1. **Route-level code splitting** — `React.lazy` + `<Suspense>` for all 16 route components in `App.jsx`.
2. **Vendor chunk splitting** — `manualChunks` in `vite.config.js` (`vendor-react`, `vendor-tanstack`, `vendor-ui`).
3. **Latin-only fonts** (prior pass) — dropped unused cyrillic/vietnamese/symbol chunks.

## 8. Known limitations & future work
- No **server-side pagination** on the Audit Trail yet (loads all rows, paginates client-side) — fine at SME scale (5–30 employees).
- No **virtualization** for very long lists.
- Initial payload is bounded by React + Router (~54 KB gzip) — to push below that, the query/tanstack + lucide layers could be deferred until after authentication.
- Backend timings are **local SQLite**; production Postgres + multi-worker not profiled.
- No load/stress testing or CDN/compression configuration measured (host-side).

---

## Summary
| Area | Result |
|---|---|
| API latency | **~10–13 ms** (local) |
| N+1 | Eliminated via `selectinload` (10 sites) |
| Indexes | 20 + FK/unique constraints |
| ML inference | Lazy-loaded, cached; async Gemini with fallback |
| Initial JS (gzip) | **~130 KB → ~98 KB** (−25 %) |
| Initial JS (raw) | **~474 KB → ~305 KB** (−36 %) |
| Route chunks | **0.9–23 KB** each, on demand |
| CSS (gzip) | 7.8 KB |
| Fonts | 8 latin woff2, lazy |
