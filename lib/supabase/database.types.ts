export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      bakery_brands: {
        Row: {
          created_at: string;
          description: string | null;
          founded_year: number | null;
          id: string;
          name: string;
          official_website_url: string | null;
          slug: string;
          status: Database["public"]["Enums"]["brand_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          id?: string;
          name: string;
          official_website_url?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["brand_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          id?: string;
          name?: string;
          official_website_url?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["brand_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      bakery_locations: {
        Row: {
          brand_id: string;
          created_at: string;
          id: string;
          latitude: number;
          longitude: number;
          lot_address: string | null;
          name: string;
          parking: Database["public"]["Enums"]["facility_state"];
          phone: string | null;
          published_at: string | null;
          region_level_1: string;
          region_level_2: string;
          region_level_3: string | null;
          road_address: string;
          search_aliases: string[];
          seating: Database["public"]["Enums"]["facility_state"];
          seed_key: string | null;
          shipping: Database["public"]["Enums"]["facility_state"];
          slug: string;
          status: Database["public"]["Enums"]["location_status"];
          takeout: Database["public"]["Enums"]["facility_state"];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          lot_address?: string | null;
          name: string;
          parking?: Database["public"]["Enums"]["facility_state"];
          phone?: string | null;
          published_at?: string | null;
          region_level_1: string;
          region_level_2: string;
          region_level_3?: string | null;
          road_address: string;
          search_aliases?: string[];
          seating?: Database["public"]["Enums"]["facility_state"];
          seed_key?: string | null;
          shipping?: Database["public"]["Enums"]["facility_state"];
          slug: string;
          status?: Database["public"]["Enums"]["location_status"];
          takeout?: Database["public"]["Enums"]["facility_state"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          lot_address?: string | null;
          name?: string;
          parking?: Database["public"]["Enums"]["facility_state"];
          phone?: string | null;
          published_at?: string | null;
          region_level_1?: string;
          region_level_2?: string;
          region_level_3?: string | null;
          road_address?: string;
          search_aliases?: string[];
          seating?: Database["public"]["Enums"]["facility_state"];
          seed_key?: string | null;
          shipping?: Database["public"]["Enums"]["facility_state"];
          slug?: string;
          status?: Database["public"]["Enums"]["location_status"];
          takeout?: Database["public"]["Enums"]["facility_state"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bakery_locations_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "bakery_brands";
            referencedColumns: ["id"];
          },
        ];
      };
      bread_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bread_categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "bread_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: {
          closes_at: string | null;
          created_at: string;
          day_of_week: number;
          id: string;
          is_closed: boolean;
          location_id: string;
          opens_at: string | null;
          sequence: number;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          closes_at?: string | null;
          created_at?: string;
          day_of_week: number;
          id?: string;
          is_closed?: boolean;
          location_id: string;
          opens_at?: string | null;
          sequence?: number;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          closes_at?: string | null;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          is_closed?: boolean;
          location_id?: string;
          opens_at?: string | null;
          sequence?: number;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      correction_reports: {
        Row: {
          category: Database["public"]["Enums"]["correction_category"];
          created_at: string;
          description: string;
          id: string;
          location_id: string;
          proposed_value: Json | null;
          reporter_id: string | null;
          resolved_at: string | null;
          source_url: string | null;
          status: Database["public"]["Enums"]["correction_status"];
          updated_at: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["correction_category"];
          created_at?: string;
          description: string;
          id?: string;
          location_id: string;
          proposed_value?: Json | null;
          reporter_id?: string | null;
          resolved_at?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["correction_status"];
          updated_at?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["correction_category"];
          created_at?: string;
          description?: string;
          id?: string;
          location_id?: string;
          proposed_value?: Json | null;
          reporter_id?: string | null;
          resolved_at?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["correction_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "correction_reports_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      external_accounts: {
        Row: {
          brand_id: string | null;
          created_at: string;
          handle: string | null;
          id: string;
          location_id: string | null;
          officiality: Database["public"]["Enums"]["account_officiality"];
          officiality_evidence: string | null;
          platform: Database["public"]["Enums"]["account_platform"];
          status: Database["public"]["Enums"]["resource_status"];
          updated_at: string;
          url: string;
          verified_at: string | null;
        };
        Insert: {
          brand_id?: string | null;
          created_at?: string;
          handle?: string | null;
          id?: string;
          location_id?: string | null;
          officiality?: Database["public"]["Enums"]["account_officiality"];
          officiality_evidence?: string | null;
          platform: Database["public"]["Enums"]["account_platform"];
          status?: Database["public"]["Enums"]["resource_status"];
          updated_at?: string;
          url: string;
          verified_at?: string | null;
        };
        Update: {
          brand_id?: string | null;
          created_at?: string;
          handle?: string | null;
          id?: string;
          location_id?: string | null;
          officiality?: Database["public"]["Enums"]["account_officiality"];
          officiality_evidence?: string | null;
          platform?: Database["public"]["Enums"]["account_platform"];
          status?: Database["public"]["Enums"]["resource_status"];
          updated_at?: string;
          url?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "external_accounts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "bakery_brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "external_accounts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      fame_evidence: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_sponsored: boolean;
          location_id: string;
          occurred_at: string | null;
          source_id: string | null;
          status: Database["public"]["Enums"]["evidence_status"];
          title: string;
          type: Database["public"]["Enums"]["fame_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_sponsored?: boolean;
          location_id: string;
          occurred_at?: string | null;
          source_id?: string | null;
          status?: Database["public"]["Enums"]["evidence_status"];
          title: string;
          type: Database["public"]["Enums"]["fame_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_sponsored?: boolean;
          location_id?: string;
          occurred_at?: string | null;
          source_id?: string | null;
          status?: Database["public"]["Enums"]["evidence_status"];
          title?: string;
          type?: Database["public"]["Enums"]["fame_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fame_evidence_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fame_evidence_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      location_bread_categories: {
        Row: {
          category_id: string;
          location_id: string;
        };
        Insert: {
          category_id: string;
          location_id: string;
        };
        Update: {
          category_id?: string;
          location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_bread_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "bread_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_bread_categories_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          availability: Database["public"]["Enums"]["menu_availability"];
          checked_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_signature: boolean;
          location_id: string;
          name: string;
          price: number | null;
          price_note: string | null;
          status: Database["public"]["Enums"]["menu_status"];
          updated_at: string;
        };
        Insert: {
          availability?: Database["public"]["Enums"]["menu_availability"];
          checked_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_signature?: boolean;
          location_id: string;
          name: string;
          price?: number | null;
          price_note?: string | null;
          status?: Database["public"]["Enums"]["menu_status"];
          updated_at?: string;
        };
        Update: {
          availability?: Database["public"]["Enums"]["menu_availability"];
          checked_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_signature?: boolean;
          location_id?: string;
          name?: string;
          price?: number | null;
          price_note?: string | null;
          status?: Database["public"]["Enums"]["menu_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      place_candidate_review_actions: {
        Row: {
          action: Database["public"]["Enums"]["place_candidate_review_action"];
          candidate_id: string;
          created_at: string;
          id: string;
          matched_location_id: string | null;
          next_status: Database["public"]["Enums"]["place_candidate_status"];
          previous_status: Database["public"]["Enums"]["place_candidate_status"];
          reason: string;
          reviewer_id: string | null;
          reviewer_label: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["place_candidate_review_action"];
          candidate_id: string;
          created_at?: string;
          id?: string;
          matched_location_id?: string | null;
          next_status: Database["public"]["Enums"]["place_candidate_status"];
          previous_status: Database["public"]["Enums"]["place_candidate_status"];
          reason: string;
          reviewer_id?: string | null;
          reviewer_label?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["place_candidate_review_action"];
          candidate_id?: string;
          created_at?: string;
          id?: string;
          matched_location_id?: string | null;
          next_status?: Database["public"]["Enums"]["place_candidate_status"];
          previous_status?: Database["public"]["Enums"]["place_candidate_status"];
          reason?: string;
          reviewer_id?: string | null;
          reviewer_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_candidate_review_actions_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "place_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_candidate_review_actions_matched_location_id_fkey";
            columns: ["matched_location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      place_candidates: {
        Row: {
          address: string;
          approved_location_id: string | null;
          category: string;
          created_at: string;
          external_id: string;
          first_seen_at: string;
          id: string;
          last_seen_at: string;
          latitude: number;
          longitude: number;
          matched_location_id: string | null;
          name: string;
          phone: string | null;
          place_url: string;
          provider: string;
          region_level_1: string;
          region_level_2: string;
          region_level_3: string | null;
          reviewed_at: string | null;
          road_address: string | null;
          status: Database["public"]["Enums"]["place_candidate_status"];
          updated_at: string;
        };
        Insert: {
          address: string;
          approved_location_id?: string | null;
          category: string;
          created_at?: string;
          external_id: string;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          latitude: number;
          longitude: number;
          matched_location_id?: string | null;
          name: string;
          phone?: string | null;
          place_url: string;
          provider: string;
          region_level_1: string;
          region_level_2: string;
          region_level_3?: string | null;
          reviewed_at?: string | null;
          road_address?: string | null;
          status?: Database["public"]["Enums"]["place_candidate_status"];
          updated_at?: string;
        };
        Update: {
          address?: string;
          approved_location_id?: string | null;
          category?: string;
          created_at?: string;
          external_id?: string;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          latitude?: number;
          longitude?: number;
          matched_location_id?: string | null;
          name?: string;
          phone?: string | null;
          place_url?: string;
          provider?: string;
          region_level_1?: string;
          region_level_2?: string;
          region_level_3?: string | null;
          reviewed_at?: string | null;
          road_address?: string | null;
          status?: Database["public"]["Enums"]["place_candidate_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_candidates_approved_location_id_fkey";
            columns: ["approved_location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_candidates_matched_location_id_fkey";
            columns: ["matched_location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      review_actions: {
        Row: {
          action: Database["public"]["Enums"]["review_action_type"];
          created_at: string;
          id: string;
          next_status: Database["public"]["Enums"]["correction_status"];
          previous_status: Database["public"]["Enums"]["correction_status"];
          reason: string;
          report_id: string;
          reviewer_id: string | null;
          reviewer_label: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["review_action_type"];
          created_at?: string;
          id?: string;
          next_status: Database["public"]["Enums"]["correction_status"];
          previous_status: Database["public"]["Enums"]["correction_status"];
          reason: string;
          report_id: string;
          reviewer_id?: string | null;
          reviewer_label?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["review_action_type"];
          created_at?: string;
          id?: string;
          next_status?: Database["public"]["Enums"]["correction_status"];
          previous_status?: Database["public"]["Enums"]["correction_status"];
          reason?: string;
          report_id?: string;
          reviewer_id?: string | null;
          reviewer_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_actions_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "correction_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_bakeries: {
        Row: {
          created_at: string;
          location_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          location_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          location_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_bakeries_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          created_at: string;
          effective_from: string | null;
          effective_until: string | null;
          external_account_id: string | null;
          id: string;
          published_at: string | null;
          publisher: string | null;
          retrieved_at: string;
          snapshot_ref: string | null;
          status: Database["public"]["Enums"]["resource_status"];
          type: Database["public"]["Enums"]["source_type"];
          url: string | null;
        };
        Insert: {
          created_at?: string;
          effective_from?: string | null;
          effective_until?: string | null;
          external_account_id?: string | null;
          id?: string;
          published_at?: string | null;
          publisher?: string | null;
          retrieved_at?: string;
          snapshot_ref?: string | null;
          status?: Database["public"]["Enums"]["resource_status"];
          type: Database["public"]["Enums"]["source_type"];
          url?: string | null;
        };
        Update: {
          created_at?: string;
          effective_from?: string | null;
          effective_until?: string | null;
          external_account_id?: string | null;
          id?: string;
          published_at?: string | null;
          publisher?: string | null;
          retrieved_at?: string;
          snapshot_ref?: string | null;
          status?: Database["public"]["Enums"]["resource_status"];
          type?: Database["public"]["Enums"]["source_type"];
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sources_external_account_id_fkey";
            columns: ["external_account_id"];
            isOneToOne: false;
            referencedRelation: "external_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      special_schedules: {
        Row: {
          closes_at: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          location_id: string;
          note: string | null;
          opens_at: string | null;
          source_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["schedule_status"];
          type: Database["public"]["Enums"]["schedule_type"];
          updated_at: string;
        };
        Insert: {
          closes_at?: string | null;
          created_at?: string;
          ends_at: string;
          id?: string;
          location_id: string;
          note?: string | null;
          opens_at?: string | null;
          source_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["schedule_status"];
          type: Database["public"]["Enums"]["schedule_type"];
          updated_at?: string;
        };
        Update: {
          closes_at?: string | null;
          created_at?: string;
          ends_at?: string;
          id?: string;
          location_id?: string;
          note?: string | null;
          opens_at?: string | null;
          source_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["schedule_status"];
          type?: Database["public"]["Enums"]["schedule_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "special_schedules_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "special_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      verification_records: {
        Row: {
          created_at: string;
          field: Database["public"]["Enums"]["verification_field"];
          grade: Database["public"]["Enums"]["verification_grade"];
          id: string;
          location_id: string;
          menu_item_id: string | null;
          next_review_at: string;
          normalized_value: Json;
          note: string | null;
          result: Database["public"]["Enums"]["verification_result"];
          rule_version: number;
          source_authority: Database["public"]["Enums"]["source_authority"];
          source_id: string;
          verified_at: string;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          field: Database["public"]["Enums"]["verification_field"];
          grade: Database["public"]["Enums"]["verification_grade"];
          id?: string;
          location_id: string;
          menu_item_id?: string | null;
          next_review_at: string;
          normalized_value: Json;
          note?: string | null;
          result: Database["public"]["Enums"]["verification_result"];
          rule_version?: number;
          source_authority: Database["public"]["Enums"]["source_authority"];
          source_id: string;
          verified_at?: string;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          field?: Database["public"]["Enums"]["verification_field"];
          grade?: Database["public"]["Enums"]["verification_grade"];
          id?: string;
          location_id?: string;
          menu_item_id?: string | null;
          next_review_at?: string;
          normalized_value?: Json;
          note?: string | null;
          result?: Database["public"]["Enums"]["verification_result"];
          rule_version?: number;
          source_authority?: Database["public"]["Enums"]["source_authority"];
          source_id?: string;
          verified_at?: string;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "verification_records_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "bakery_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_records_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_records_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      review_correction_report: {
        Args: {
          report_id: string;
          review_action: Database["public"]["Enums"]["review_action_type"];
          review_reason: string;
        };
        Returns: {
          category: Database["public"]["Enums"]["correction_category"];
          created_at: string;
          description: string;
          id: string;
          location_id: string;
          proposed_value: Json | null;
          reporter_id: string | null;
          resolved_at: string | null;
          source_url: string | null;
          status: Database["public"]["Enums"]["correction_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "correction_reports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_place_candidate: {
        Args: {
          candidate_id: string;
          duplicate_location_id?: string;
          review_action: Database["public"]["Enums"]["place_candidate_review_action"];
          review_reason: string;
        };
        Returns: {
          address: string;
          approved_location_id: string | null;
          category: string;
          created_at: string;
          external_id: string;
          first_seen_at: string;
          id: string;
          last_seen_at: string;
          latitude: number;
          longitude: number;
          matched_location_id: string | null;
          name: string;
          phone: string | null;
          place_url: string;
          provider: string;
          region_level_1: string;
          region_level_2: string;
          region_level_3: string | null;
          reviewed_at: string | null;
          road_address: string | null;
          status: Database["public"]["Enums"]["place_candidate_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "place_candidates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      account_officiality:
        | "official"
        | "semi_official"
        | "user_generated"
        | "unknown";
      account_platform:
        | "website"
        | "instagram"
        | "naver_blog"
        | "naver_place"
        | "kakao_channel"
        | "youtube"
        | "other";
      app_role: "user" | "reviewer" | "admin";
      brand_status: "active" | "inactive";
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
      evidence_status: "active" | "expired" | "disputed";
      facility_state: "yes" | "no" | "limited" | "unknown";
      fame_type:
        | "award"
        | "media"
        | "heritage"
        | "local_landmark"
        | "specialty"
        | "editorial"
        | "save_count";
      location_status:
        | "draft"
        | "active"
        | "temporary_closed"
        | "closed"
        | "relocated"
        | "verification_needed";
      menu_availability:
        | "regular"
        | "seasonal"
        | "limited"
        | "unknown"
        | "discontinued";
      menu_status: "active" | "hidden" | "discontinued";
      place_candidate_review_action:
        | "hold"
        | "approve"
        | "reject"
        | "mark_duplicate";
      place_candidate_status:
        | "discovered"
        | "in_review"
        | "approved"
        | "rejected"
        | "duplicate";
      resource_status:
        | "active"
        | "accessible"
        | "unavailable"
        | "private"
        | "deleted";
      review_action_type:
        | "triage"
        | "approve"
        | "reject"
        | "hold"
        | "mark_duplicate"
        | "request_more_info";
      schedule_status: "draft" | "confirmed" | "expired" | "cancelled";
      schedule_type:
        | "temporary_closed"
        | "special_open"
        | "changed_hours"
        | "event";
      source_authority:
        | "official"
        | "authoritative"
        | "secondary"
        | "community";
      source_type:
        | "official_site"
        | "official_sns"
        | "phone"
        | "map_api"
        | "public_data"
        | "tourism_data"
        | "media"
        | "user_report"
        | "onsite"
        | "other";
      verification_field:
        | "address"
        | "coordinates"
        | "phone"
        | "business_hours"
        | "closure"
        | "menu"
        | "price"
        | "facility"
        | "official_account"
        | "fame";
      verification_grade: "A" | "B" | "C" | "D";
      verification_result:
        | "confirmed"
        | "supports"
        | "conflicts"
        | "superseded"
        | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_officiality: [
        "official",
        "semi_official",
        "user_generated",
        "unknown",
      ],
      account_platform: [
        "website",
        "instagram",
        "naver_blog",
        "naver_place",
        "kakao_channel",
        "youtube",
        "other",
      ],
      app_role: ["user", "reviewer", "admin"],
      brand_status: ["active", "inactive"],
      correction_category: [
        "hours",
        "closure",
        "relocation",
        "menu_price",
        "phone_address",
        "other",
      ],
      correction_status: [
        "submitted",
        "triaged",
        "in_review",
        "accepted",
        "rejected",
        "duplicate",
      ],
      evidence_status: ["active", "expired", "disputed"],
      facility_state: ["yes", "no", "limited", "unknown"],
      fame_type: [
        "award",
        "media",
        "heritage",
        "local_landmark",
        "specialty",
        "editorial",
        "save_count",
      ],
      location_status: [
        "draft",
        "active",
        "temporary_closed",
        "closed",
        "relocated",
        "verification_needed",
      ],
      menu_availability: [
        "regular",
        "seasonal",
        "limited",
        "unknown",
        "discontinued",
      ],
      menu_status: ["active", "hidden", "discontinued"],
      place_candidate_review_action: [
        "hold",
        "approve",
        "reject",
        "mark_duplicate",
      ],
      place_candidate_status: [
        "discovered",
        "in_review",
        "approved",
        "rejected",
        "duplicate",
      ],
      resource_status: [
        "active",
        "accessible",
        "unavailable",
        "private",
        "deleted",
      ],
      review_action_type: [
        "triage",
        "approve",
        "reject",
        "hold",
        "mark_duplicate",
        "request_more_info",
      ],
      schedule_status: ["draft", "confirmed", "expired", "cancelled"],
      schedule_type: [
        "temporary_closed",
        "special_open",
        "changed_hours",
        "event",
      ],
      source_authority: ["official", "authoritative", "secondary", "community"],
      source_type: [
        "official_site",
        "official_sns",
        "phone",
        "map_api",
        "public_data",
        "tourism_data",
        "media",
        "user_report",
        "onsite",
        "other",
      ],
      verification_field: [
        "address",
        "coordinates",
        "phone",
        "business_hours",
        "closure",
        "menu",
        "price",
        "facility",
        "official_account",
        "fame",
      ],
      verification_grade: ["A", "B", "C", "D"],
      verification_result: [
        "confirmed",
        "supports",
        "conflicts",
        "superseded",
        "rejected",
      ],
    },
  },
} as const;
