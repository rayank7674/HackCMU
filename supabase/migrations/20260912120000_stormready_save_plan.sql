-- StormReady Phase 2 - Save My Plan schema
--
-- Apply with `supabase db push` (linked project) or paste this file into the
-- Supabase SQL editor. Postgres / Supabase only - no MongoDB.
--
-- Unknownable semantics (must match types/domain.ts):
--   "unknown" means "not confirmed". It is not false, 0, "", [], or null.
--   Confirmed negatives (false, 0, []) are stored as those values.
--   Unknownable<string|union> columns are text with the sentinel 'unknown'.
--   Unknownable<number|boolean|array> columns are jsonb: 12 / true / [] / "unknown".
--
-- Auth0 later: persist the Auth0 user `sub` on public.users.auth0_sub.
-- RLS matches auth.jwt()->>'sub' so an Auth0 ID token (role=authenticated)
-- can be passed to the Supabase client. Server routes may instead verify
-- Auth0 and write with the service role (bypasses RLS).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- JWT subject from Auth0 (or Supabase Auth). Used by RLS only.
-- Not SECURITY DEFINER - it only reads the request JWT.
CREATE OR REPLACE FUNCTION public.request_auth0_sub()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'sub', ''),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  );
$$;

-- ---------------------------------------------------------------------------
-- User (Auth0 subject / email)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_sub text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_auth0_sub_not_blank CHECK (char_length(trim(auth0_sub)) > 0)
);

CREATE UNIQUE INDEX users_auth0_sub_uidx ON public.users (auth0_sub);

COMMENT ON TABLE public.users IS
  'StormReady account row keyed by Auth0 sub. Distinct from auth.users.';
COMMENT ON COLUMN public.users.auth0_sub IS
  'Auth0 subject claim (e.g. auth0|abc123). Required identity for save/load.';
COMMENT ON COLUMN public.users.email IS
  'Optional Auth0 email. Null until Auth0 provides it - not an Unknownable field.';

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- HomeProfile
-- ---------------------------------------------------------------------------
CREATE TABLE public.home_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  address_line text NOT NULL DEFAULT 'unknown',
  city text NOT NULL DEFAULT 'unknown',
  state text NOT NULL DEFAULT 'unknown',
  postal_code text NOT NULL DEFAULT 'unknown',
  location jsonb NOT NULL DEFAULT '{
    "latitude":"unknown","longitude":"unknown","county":"unknown",
    "nwsForecastOffice":"unknown","nwsForecastZone":"unknown",
    "nwsCountyZone":"unknown","provenance":"unknown"
  }'::jsonb,
  address_provenance text NOT NULL DEFAULT 'user_reported',
  dwelling_type text NOT NULL DEFAULT 'unknown',
  stories jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  year_built jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  construction text NOT NULL DEFAULT 'unknown',
  flood_zone text NOT NULL DEFAULT 'unknown',
  elevation_feet jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_basement jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_safe_interior_room jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_hurricane_shutters jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_backup_power jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  backup_power_type text NOT NULL DEFAULT 'unknown',
  has_well_water jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_septic jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  roof_age_years jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  notes text NOT NULL DEFAULT 'unknown',
  attributes_provenance text NOT NULL DEFAULT 'user_reported',
  CONSTRAINT home_profiles_id_not_blank CHECK (char_length(trim(id)) > 0),
  CONSTRAINT home_profiles_address_provenance_chk
    CHECK (address_provenance IN ('user_reported', 'external_source', 'unknown')),
  CONSTRAINT home_profiles_attributes_provenance_chk
    CHECK (attributes_provenance IN ('user_reported', 'external_source', 'unknown'))
);

COMMENT ON TABLE public.home_profiles IS
  'One latest HomeProfile per user. jsonb unknownables store true/false/number or "unknown".';
COMMENT ON COLUMN public.home_profiles.id IS
  'Domain HomeProfile.id from the local snapshot (not the Auth0 user id).';
COMMENT ON COLUMN public.home_profiles.has_backup_power IS
  'Unknownable<boolean>: true | false | "unknown". "unknown" must not be read as no generator.';
COMMENT ON COLUMN public.home_profiles.location IS
  'GeocodedLocation JSON: unknownable coords/zones plus provenance.';

CREATE TRIGGER home_profiles_set_updated_at
  BEFORE UPDATE ON public.home_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- HouseholdProfile
-- ---------------------------------------------------------------------------
CREATE TABLE public.household_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  occupant_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  infants_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  children_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  adults_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  seniors_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_pregnancy jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_mobility_needs jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_sensory_or_cognitive_needs jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_power_dependent_medical_device jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  has_prescription_medications jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  pet_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  pet_types jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  vehicle_count jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  can_self_evacuate jsonb NOT NULL DEFAULT '"unknown"'::jsonb,
  preferred_language text NOT NULL DEFAULT 'unknown',
  budget_class text NOT NULL DEFAULT 'unknown',
  notes text NOT NULL DEFAULT 'unknown',
  provenance text NOT NULL DEFAULT 'user_reported',
  CONSTRAINT household_profiles_id_not_blank CHECK (char_length(trim(id)) > 0),
  CONSTRAINT household_profiles_provenance_chk
    CHECK (provenance IN ('user_reported', 'external_source', 'unknown'))
);

COMMENT ON TABLE public.household_profiles IS
  'One latest HouseholdProfile per user. 0 is confirmed none; "unknown" was skipped.';
COMMENT ON COLUMN public.household_profiles.pet_count IS
  'Unknownable<number>: 0 means no pets; "unknown" means the question was skipped.';
COMMENT ON COLUMN public.household_profiles.pet_types IS
  'Unknownable<PetType[]>: [] is confirmed none listed; "unknown" is unanswered.';
COMMENT ON COLUMN public.household_profiles.budget_class IS
  'Unknownable<BudgetClass>. "unknown" is not flexible - prefer no-cost / low-cost.';

CREATE TRIGGER household_profiles_set_updated_at
  BEFORE UPDATE ON public.household_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- GeneratedRecommendation - latest plan snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE public.generated_recommendations (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  hazards jsonb,
  source text NOT NULL DEFAULT 'save_plan',
  CONSTRAINT generated_recommendations_id_not_blank CHECK (char_length(trim(id)) > 0)
);

COMMENT ON TABLE public.generated_recommendations IS
  'Latest recommendation snapshot for a user. hazards null means not persisted - not all-clear.';
COMMENT ON COLUMN public.generated_recommendations.recommendations IS
  'JSON array of Recommendation objects from types/domain.ts.';
COMMENT ON COLUMN public.generated_recommendations.hazards IS
  'Optional HazardState JSON. Null = not saved; empty hazards + allClear unknown is not an all-clear.';

CREATE TRIGGER generated_recommendations_set_updated_at
  BEFORE UPDATE ON public.generated_recommendations
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AuditLog (rule id + source + timestamp)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  recommendation_id text
);

CREATE INDEX audit_logs_user_created_idx
  ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_rule_id_idx
  ON public.audit_logs (rule_id);

COMMENT ON TABLE public.audit_logs IS
  'Append-only save/eval trail. rule_id may be the sentinel unknown.';
COMMENT ON COLUMN public.audit_logs.source IS
  'Provenance or writer (user_reported, external_source, save_plan, rules_engine).';

-- ---------------------------------------------------------------------------
-- Row Level Security - deny-by-default for anon; own-row for JWT sub
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth0_sub = public.request_auth0_sub());
CREATE POLICY users_insert_own ON public.users
  FOR INSERT WITH CHECK (auth0_sub = public.request_auth0_sub());
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth0_sub = public.request_auth0_sub())
  WITH CHECK (auth0_sub = public.request_auth0_sub());

CREATE POLICY home_profiles_select_own ON public.home_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = home_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY home_profiles_insert_own ON public.home_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = home_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY home_profiles_update_own ON public.home_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = home_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = home_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );

CREATE POLICY household_profiles_select_own ON public.household_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = household_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY household_profiles_insert_own ON public.household_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = household_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY household_profiles_update_own ON public.household_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = household_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = household_profiles.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );

CREATE POLICY generated_recommendations_select_own ON public.generated_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = generated_recommendations.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY generated_recommendations_insert_own ON public.generated_recommendations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = generated_recommendations.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY generated_recommendations_update_own ON public.generated_recommendations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = generated_recommendations.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = generated_recommendations.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );

CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = audit_logs.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
CREATE POLICY audit_logs_insert_own ON public.audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = audit_logs.user_id
        AND u.auth0_sub = public.request_auth0_sub()
    )
  );
