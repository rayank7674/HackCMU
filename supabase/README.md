# StormReady database (Supabase)

Phase 2 schema for **Save My Plan**. Auth0 is not required to apply this SQL.

## Apply the schema

### Option A — Supabase SQL editor

1. Open the Supabase project → **SQL Editor**.
2. Paste [`migrations/20260912120000_stormready_save_plan.sql`](./migrations/20260912120000_stormready_save_plan.sql).
3. Run it.

### Option B — CLI (`supabase db push`)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies every file under `migrations/` to the linked remote.

Local iteration (optional):

```bash
npx supabase start
npx supabase db reset
```

## Auth0 identity

Save/load identify a household by the Auth0 user **`sub`** (and optionally `email`).

1. After login, the session exposes `user.sub` (e.g. `auth0|abc123`).
2. `/api/save-plan` and `/api/load-plan` read that `sub` via `resolveAuthIdentity` in `lib/auth/identity.ts`.
3. Rows land in `public.users.auth0_sub`. Profiles and the latest recommendation snapshot hang off `users.id`.

If you later pass the Auth0 **ID token** to the Supabase client (third-party auth):

- Add an Auth0 Action that sets `role: "authenticated"` on the **ID token**.
- Enable Auth0 under Supabase **Authentication → Third-party auth**.
- RLS already matches `auth.jwt()->>'sub'` to `users.auth0_sub`.

Until that JWT is wired, server routes should verify Auth0 and write with `SUPABASE_SERVICE_ROLE_KEY` (never expose that key to the browser). The anon key alone cannot insert past RLS.

## Tables

| Table | Domain type | Notes |
| --- | --- | --- |
| `users` | User | `auth0_sub` + optional `email` |
| `home_profiles` | `HomeProfile` | One latest home per user |
| `household_profiles` | `HouseholdProfile` | One latest household per user |
| `generated_recommendations` | `Recommendation[]` (+ optional `HazardState`) | Latest plan snapshot |
| `audit_logs` | AuditLog | `rule_id`, `source`, `created_at` |

Hazard alert cache is omitted on purpose.

Unknownable columns use the `'unknown'` sentinel (text) or jsonb `"unknown"` so unknown is never coerced to no.
