# StormReady

Anonymous household preparedness: **Your home. Your risk. Your plan.**

Phase 1 is a mobile-first Next.js app. You can finish a home setup and open a plan without creating an account. Home and household details stay in this browser via the existing `@/lib/stormready` profile store.

## Local setup

1. Install Node.js 20+ and npm.
2. Optional: copy environment notes (no secrets are required):

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

1. Welcome at `/` — Get Started (Log In is a disabled placeholder).
2. Onboarding at `/onboarding` — location, housing, home characteristics, assets, household constraints, immediate budget. Each step writes through `saveHomeProfile` / `saveHouseholdProfile`.
3. Plan at `/plan` — saved location, official alert card, compact conditions, and 3–5 actions when those APIs exist.

Bottom navigation: Home / Plan / Map / Help / Profile. Map is a placeholder only (no Mapbox).

`/dashboard` redirects to `/`. The old rooms lobby is isolated under `components/layout/` and is not on the user path.

## API routes the UI will use

The UI calls these when present and fails closed if they 404 or return an unusable body. It never fabricates alerts or an all-clear.

| Route | Used for |
| --- | --- |
| `GET`/`POST` `/api/geocode` | Optional location lookup after the address/ZIP step |
| `GET`/`POST` `/api/alerts` | Official hazard picture (`HazardState`) |
| `POST`/`GET` `/api/recommendations` | Deterministic actions (`Recommendation[]`) |

`GET`/`POST` `/api/core-logic` is leftover skeleton and is not on the StormReady user path.

## Later / optional services

Auth0, Supabase Save My Plan, and Mapbox/Places are out of scope. See `.env.example` for placeholder variable names only — Phase 1 does not read them.

## Domain contract

Import types and the anonymous store from `@/lib/stormready`. Do not declare parallel profile, hazard, or recommendation models.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), import the repo. Framework preset: **Next.js**.
3. Deploy. No environment variables are required for the anonymous Phase 1 path.
