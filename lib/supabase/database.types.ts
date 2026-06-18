export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      bakery_locations: {
        Row: {
          id: string;
          brand_id: string;
          seed_key: string | null;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["location_status"];
          road_address: string;
          lot_address: string | null;
          latitude: number;
          longitude: number;
          region_level_1: string;
          region_level_2: string;
          region_level_3: string | null;
          phone: string | null;
          timezone: string;
          parking: Database["public"]["Enums"]["facility_state"];
          seating: Database["public"]["Enums"]["facility_state"];
          takeout: Database["public"]["Enums"]["facility_state"];
          shipping: Database["public"]["Enums"]["facility_state"];
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          seed_key?: string | null;
          name: string;
          slug: string;
          status?: Database["public"]["Enums"]["location_status"];
          road_address: string;
          lot_address?: string | null;
          latitude: number;
          longitude: number;
          region_level_1: string;
          region_level_2: string;
          region_level_3?: string | null;
          phone?: string | null;
          timezone?: string;
          parking?: Database["public"]["Enums"]["facility_state"];
          seating?: Database["public"]["Enums"]["facility_state"];
          takeout?: Database["public"]["Enums"]["facility_state"];
          shipping?: Database["public"]["Enums"]["facility_state"];
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["bakery_locations"]["Insert"]
        >;
        Relationships: [];
      };
      correction_reports: {
        Row: {
          id: string;
          location_id: string;
          reporter_id: string | null;
          category: Database["public"]["Enums"]["correction_category"];
          proposed_value: Json | null;
          description: string;
          source_url: string | null;
          status: Database["public"]["Enums"]["correction_status"];
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          location_id: string;
          reporter_id?: string | null;
          category: Database["public"]["Enums"]["correction_category"];
          proposed_value?: Json | null;
          description: string;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["correction_status"];
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["correction_reports"]["Insert"]
        >;
        Relationships: [];
      };
      review_actions: {
        Row: {
          id: string;
          report_id: string;
          reviewer_id: string;
          action: Database["public"]["Enums"]["review_action_type"];
          reason: string;
          previous_status: Database["public"]["Enums"]["correction_status"];
          next_status: Database["public"]["Enums"]["correction_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          reviewer_id: string;
          action: Database["public"]["Enums"]["review_action_type"];
          reason: string;
          previous_status: Database["public"]["Enums"]["correction_status"];
          next_status: Database["public"]["Enums"]["correction_status"];
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["review_actions"]["Insert"]
        >;
        Relationships: [];
      };
      saved_bakeries: {
        Row: {
          user_id: string;
          location_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          location_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["saved_bakeries"]["Insert"]
        >;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      review_correction_report: {
        Args: {
          report_id: string;
          review_action: Database["public"]["Enums"]["review_action_type"];
          review_reason: string;
        };
        Returns: Database["public"]["Tables"]["correction_reports"]["Row"];
      };
    };
    Enums: {
      app_role: "user" | "reviewer" | "admin";
      correction_category:
        | "hours"
        | "closure"
        | "relocation"
        | "menu_price"
        | "phone_address"
        | "other";
      correction_status:
        | "submitted"
        | "triaged"
        | "in_review"
        | "accepted"
        | "rejected"
        | "duplicate";
      facility_state: "yes" | "no" | "limited" | "unknown";
      location_status:
        | "draft"
        | "active"
        | "temporary_closed"
        | "closed"
        | "relocated"
        | "verification_needed";
      review_action_type:
        | "triage"
        | "approve"
        | "reject"
        | "hold"
        | "mark_duplicate"
        | "request_more_info";
    };
    CompositeTypes: Record<string, never>;
  };
};
