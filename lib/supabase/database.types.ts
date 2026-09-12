/**
 * Hand-maintained Database types for the Phase 2 Save My Plan schema.
 * Keep in sync with supabase/migrations/20260912120000_stormready_save_plan.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRow = {
  id: string;
  auth0_sub: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type HomeProfileRow = {
  user_id: string;
  id: string;
  created_at: string;
  updated_at: string;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  location: Json;
  address_provenance: string;
  dwelling_type: string;
  stories: Json;
  year_built: Json;
  construction: string;
  flood_zone: string;
  elevation_feet: Json;
  has_basement: Json;
  has_safe_interior_room: Json;
  has_hurricane_shutters: Json;
  has_backup_power: Json;
  backup_power_type: string;
  has_well_water: Json;
  has_septic: Json;
  roof_age_years: Json;
  notes: string;
  attributes_provenance: string;
};

export type HouseholdProfileRow = {
  user_id: string;
  id: string;
  created_at: string;
  updated_at: string;
  occupant_count: Json;
  infants_count: Json;
  children_count: Json;
  adults_count: Json;
  seniors_count: Json;
  has_pregnancy: Json;
  has_mobility_needs: Json;
  has_sensory_or_cognitive_needs: Json;
  has_power_dependent_medical_device: Json;
  has_prescription_medications: Json;
  pet_count: Json;
  pet_types: Json;
  vehicle_count: Json;
  can_self_evacuate: Json;
  preferred_language: string;
  budget_class: string;
  notes: string;
  provenance: string;
};

export type GeneratedRecommendationRow = {
  user_id: string;
  id: string;
  created_at: string;
  updated_at: string;
  recommendations: Json;
  hazards: Json | null;
  source: string;
};

export type AuditLogRow = {
  id: string;
  user_id: string;
  rule_id: string;
  source: string;
  created_at: string;
  recommendation_id: string | null;
};

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<
        UserRow,
        Partial<UserRow> & Pick<UserRow, "auth0_sub">,
        Partial<UserRow>
      >;
      home_profiles: TableDef<
        HomeProfileRow,
        HomeProfileRow,
        Partial<HomeProfileRow>
      >;
      household_profiles: TableDef<
        HouseholdProfileRow,
        HouseholdProfileRow,
        Partial<HouseholdProfileRow>
      >;
      generated_recommendations: TableDef<
        GeneratedRecommendationRow,
        GeneratedRecommendationRow,
        Partial<GeneratedRecommendationRow>
      >;
      audit_logs: TableDef<
        AuditLogRow,
        Omit<AuditLogRow, "id" | "created_at"> &
          Partial<Pick<AuditLogRow, "id" | "created_at">>,
        Partial<AuditLogRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      request_auth0_sub: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
