# StormReady

Anonymous household preparedness: **Your home. Your risk. Your plan.**

Phase 1 is a mobile-first Next.js app. You can finish a home setup and open a plan without creating an account. Home and household details stay in this browser via the existing `@/lib/stormready` profile store.

Phase 2 adds optional **Auth0** login and **Save My Plan**. Anonymous onboarding and plan browse still work with no login.

Phase 3 fills **Help** (official FEMA / Ready.gov / NWS links with source labels) and a simple **Map** (Leaflet + OpenStreetMap by default).

## Local setup

1. Install Node.js 20+ and npm.
2. Optional: copy environment notes (no secrets are required to build or use the anonymous path):

```bash
cp .env.example .env.local
```

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run typecheck
npm run build
```

## Anonymous path

1. Welcome at `/` — Get Started. **Log In** is enabled only when Auth0 env is present; otherwise it stays disabled. The rest of setup never requires an account.
2. Onboarding at `/onboarding` — location, housing, home characteristics, assets, household constraints, immediate budget. Each step writes through `saveHomeProfile` / `saveHouseholdProfile`.
3. Plan at `/plan` — saved location, official alert card, compact conditions, and 3–5 actions grouped by time horizon (`now` / `before the next event` / `long term`). Actions are ranked by budget class (no-cost first) with cost-class badges — never dollar prices. **Save My Plan** starts Auth0 login when env is set.

Loading, error, and fail-closed unavailable states are shown for geocode, alerts, and recommendations. StormReady never fabricates alerts or an all-clear.

Bottom navigation: Home / Plan / Map / Help / Profile.

**Help** lists official preparedness, local-help, and financial-assistance pages. Financial copy is **may-be-eligible** only — apply on official sites; StormReady never promises eligibility.

**Map** is a simple Leaflet view: approximate home marker when geocode coordinates exist, otherwise a Tampa demo center with a setup prompt. A few static Tampa-area example pins (official offices, source-labeled) appear when the view is near the demo. No routing, heatmap, Places API, or “verified / best” contractors. OpenStreetMap tiles are the default so the map works with **no Mapbox token**. Optional `NEXT_PUBLIC_MAPBOX_TOKEN` swaps in Mapbox tiles.

`/dashboard` redirects to `/`.

## Auth0 + Save My Plan

The app builds and the anonymous path runs with **no Auth0 or Supabase env**. When those variables are set, login routes work and Save My Plan can persist.

### Exact environment variable names

| Name | Required to enable login | Notes |
| --- | --- | --- |
| `AUTH0_SECRET` | yes | 32-byte hex secret (`openssl rand -hex 32`) |
| `AUTH0_ISSUER_BASE_URL` | yes | `https://YOUR_DOMAIN` (tenant host). `AUTH0_DOMAIN` is also accepted |
| `AUTH0_CLIENT_ID` | yes | Regular Web Application |
| `AUTH0_CLIENT_SECRET` | yes | Server only |
| `AUTH0_BASE_URL` | recommended | `http://localhost:3000` locally; your Vercel URL in prod. `APP_BASE_URL` is also accepted |
| `NEXT_PUBLIC_SUPABASE_URL` | for persist | Save/load returns 503 without this |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for persist | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | recommended for persist | Server-only, after Auth0 verifies `sub`. Never expose to the browser |
| `K2_API_KEY` | no | Optional K2 Horizon extract. Unused unless all three K2 vars are set |
| `K2_API_BASE_URL` | no | OpenAI-compatible base (partner or self-hosted). No default production host |
| `K2_MODEL` | no | Model id for that base. Extract is `ai_inferred` display only |

Do not commit `.env` / `.env.local`.

### Auth0 application URLs to verify

This app uses the documented `/api/auth/*` paths (not v4's default `/auth/*`).

**Allowed Callback URLs**

```
http://localhost:3000/api/auth/callback
https://YOUR_VERCEL_DOMAIN/api/auth/callback
```

**Allowed Logout URLs**

```
http://localhost:3000
https://YOUR_VERCEL_DOMAIN
```

**Allowed Web Origins**

```
http://localhost:3000
https://YOUR_VERCEL_DOMAIN
```

Login: `/api/auth/login?returnTo=/plan` (or `/profile`). Logout: `/api/auth/logout?returnTo=/`. Session probe: `/api/auth/session` (does not require login).

SDK: `@auth0/nextjs-auth0` v4 (Next.js 16 App Router). `proxy.ts` mounts Auth0's login/callback/logout and protects **only** `/api/save-plan` and `/api/load-plan`. Onboarding and plan browse stay anonymous.

### Save My Plan flow

1. Unauthenticated **Save My Plan** starts Auth0 login (`returnTo` `/plan` or `/profile`).
2. After login, localStorage profile plus the latest cached recommendations (when available) upsert to Supabase. The Auth0 `sub` (and email if present) is the User key (`users.auth0_sub`).
3. On authenticated return, a newer or missing local profile is restored from Supabase.

Apply `supabase/migrations/20260912120000_stormready_save_plan.sql` (see `supabase/README.md`). Tables: `users`, `home_profiles`, `household_profiles`, `generated_recommendations`, `audit_logs`. Helpers: `saveStormReadySnapshot` / `loadStormReadySnapshot`.

Dev-only: `ALLOW_SAVE_PLAN_DEV_BYPASS=1` plus header `x-stormready-dev-sub` (ignored in production).

## API routes the UI will use

The UI calls these when present and fails closed if they 404 or return an unusable body. Transport failures (5xx / network) show an error state. It never fabricates alerts or an all-clear.

| Route | Used for |
| --- | --- |
| `GET`/`POST` `/api/geocode` | Optional location lookup after the address/ZIP step |
| `GET`/`POST` `/api/alerts` | Official hazard picture (`HazardState`) |
| `POST` `/api/recommendations` | Actions. Body: `{ home, household, hazards, hazardSource: "live" \| "unavailable" }` |
| `GET` `/api/recommendations?fixture=tampa` | Explicit Tampa quiet demo (`&scenario=quiet\|watch\|warning\|evac\|flood`) |
| `POST` `/api/save-plan` | Cloud upsert of the local snapshot. 503 without Supabase; 401 without Auth0 `sub` |
| `GET` `/api/load-plan` | Restore the latest saved snapshot for the Auth0 `sub` |
| `GET` `/api/auth/login` | Start Auth0 login (501 when Auth0 env is missing) |
| `POST` `/api/ai/k2` | Optional K2 Horizon extract of the bundled preparedness corpus (`{ task?: string }` only; no file uploads). 503 without `K2_API_KEY` / `K2_API_BASE_URL` / `K2_MODEL`. Items are `ai_inferred` display notes, never official alerts |

If `recommend()` is exported from `@/lib/stormready` (rules-engine branch), the plan screen can use it when the route is missing. A 404 still shows unavailable copy and never invents live alerts.

`GET`/`POST` `/api/core-logic` is leftover skeleton and is not on the StormReady user path.

Cloud save/restore is opt-in and gated: **503** `supabase_not_configured` when public Supabase env is missing; **401** `auth_not_configured` / `unauthenticated` when Auth0 `sub` is missing. See [`supabase/README.md`](./supabase/README.md).

## Domain contract

Import types and the anonymous store from `@/lib/stormready`. Do not declare parallel profile, hazard, or recommendation models.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), import the repo. Framework preset: **Next.js**.
3. Mirror the Auth0 / Supabase variables from `.env.example` if you want login and cloud save. The anonymous path deploys with no environment variables.
4. Confirm the Auth0 callback URLs above include the Vercel domain.
