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
3. Plan at `/plan` — saved location, official alert card, compact conditions, and 3–5 actions grouped by time horizon (`now` / `before the next event` / `long term`). Actions are ranked by budget class (no-cost first) with cost-class badges — never dollar prices. **Sign in to save** is a calm CTA until Auth0 is wired.

Loading, error, and fail-closed unavailable states are shown for geocode, alerts, and recommendations. StormReady never fabricates alerts or an all-clear.

Bottom navigation: Home / Plan / Map / Help / Profile. Map is a placeholder only (no Mapbox).

`/dashboard` redirects to `/`. The old rooms lobby is isolated under `components/layout/` and is not on the user path.

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
| `GET` `/api/auth/login` | Auth0 placeholder (501 until the SDK is installed) |

If `recommend()` is exported from `@/lib/stormready` (rules-engine branch), the plan screen can use it when the route is missing. A 404 still shows unavailable copy and never invents live alerts.

`GET`/`POST` `/api/core-logic` is leftover skeleton and is not on the StormReady user path.

## Save My Plan (Supabase, Auth0 later)

The anonymous local store is unchanged. Cloud save/restore is **opt-in** and
gated:

| Condition | `/api/save-plan` and `/api/load-plan` |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing | **503** `supabase_not_configured` |
| Supabase set, but no Auth0 user `sub` on the request | **401** `auth_not_configured` (Auth0 wiring is next) |

The app **builds and runs without these env vars**. Plan and Profile show a calm
**Sign in to save** control that points at `/api/auth/login` (placeholder until
the Auth0 SDK is installed).

### Apply the schema

See [`supabase/README.md`](./supabase/README.md). Short version:

1. SQL editor: run `supabase/migrations/20260912120000_stormready_save_plan.sql`
2. Or CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`

Tables: `users`, `home_profiles`, `household_profiles`,
`generated_recommendations`, `audit_logs`. Unknownable fields use the
`'unknown'` sentinel (text) or jsonb `"unknown"` — unknown is never stored as
`false` / `0` / `[]`.

### What Auth0 must pass later

1. After login, expose **`user.sub`** (Auth0 subject, e.g. `auth0|abc123`) and
   optionally `email`.
2. Fill `getAuth0Identity()` in [`lib/auth/identity.ts`](./lib/auth/identity.ts)
   (typically `@auth0/nextjs-auth0` `getSession()`). Replace the placeholder at
   `/api/auth/login`.
3. Server routes then upsert `public.users.auth0_sub` and the latest profiles.
   Prefer `SUPABASE_SERVICE_ROLE_KEY` on the server after the session is
   verified (never ship that key to the browser).
4. Optional: pass the Auth0 **ID token** to the Supabase client (third-party
   auth) with `role: "authenticated"` on the ID token. RLS already matches
   `auth.jwt()->>'sub'` to `users.auth0_sub`.

Local-only testing of the API (never production):

```bash
# .env.local — development only
ALLOW_SAVE_PLAN_DEV_BYPASS=1
```

```http
x-stormready-dev-sub: auth0|dev-user
```

The bypass is ignored when `NODE_ENV=production`.

Helpers: `saveStormReadySnapshot` / `loadStormReadySnapshot` in
`@/lib/stormready` (or `@/lib/supabase/persist`).

## Later / optional services

Mapbox/Places remain out of scope. Auth0 SDK install is a later PR — this repo
only leaves the identity hook and `/api/auth/login` placeholder.

## Domain contract

Import types and the anonymous store from `@/lib/stormready`. Do not declare parallel profile, hazard, or recommendation models.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), import the repo. Framework preset: **Next.js**.
3. Deploy. No environment variables are required for the anonymous Phase 1 path.
