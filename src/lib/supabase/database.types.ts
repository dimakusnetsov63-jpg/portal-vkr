export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          archived_at: string | null
          city: string
          coordinator_comment: string | null
          coordinator_name: string | null
          coordinator_phone: string | null
          coordinator_telegram: string | null
          created_at: string
          created_by: string | null
          created_by_login: string | null
          district: string | null
          document_links: Json
          features: string[]
          full_address: string
          id: string
          in_progress_count: number
          latitude: number | null
          longitude: number | null
          metro: string | null
          object_type: string
          payment_amount: number | null
          payment_type: string | null
          planned_start_count: number
          position: string | null
          priority: number
          project: string
          required_count: number
          schedule_type: string | null
          shift_times: string[]
          shift_type: string | null
          site_manager_name: string | null
          site_manager_phone: string | null
          staffed_count: number
          status: string
          updated_at: string
          updated_by: string | null
          updated_by_login: string | null
        }
        Insert: {
          archived_at?: string | null
          city: string
          coordinator_comment?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          coordinator_telegram?: string | null
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          district?: string | null
          document_links?: Json
          features?: string[]
          full_address: string
          id?: string
          in_progress_count?: number
          latitude?: number | null
          longitude?: number | null
          metro?: string | null
          object_type?: string
          payment_amount?: number | null
          payment_type?: string | null
          planned_start_count?: number
          position?: string | null
          priority?: number
          project: string
          required_count?: number
          schedule_type?: string | null
          shift_times?: string[]
          shift_type?: string | null
          site_manager_name?: string | null
          site_manager_phone?: string | null
          staffed_count?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
        }
        Update: {
          archived_at?: string | null
          city?: string
          coordinator_comment?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          coordinator_telegram?: string | null
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          district?: string | null
          document_links?: Json
          features?: string[]
          full_address?: string
          id?: string
          in_progress_count?: number
          latitude?: number | null
          longitude?: number | null
          metro?: string | null
          object_type?: string
          payment_amount?: number | null
          payment_type?: string | null
          planned_start_count?: number
          position?: string | null
          priority?: number
          project?: string
          required_count?: number
          schedule_type?: string | null
          shift_times?: string[]
          shift_type?: string | null
          site_manager_name?: string | null
          site_manager_phone?: string | null
          staffed_count?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_list_options: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          list_type: Database["public"]["Enums"]["candidate_list_type"]
          sort_order: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          list_type: Database["public"]["Enums"]["candidate_list_type"]
          sort_order?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          list_type?: Database["public"]["Enums"]["candidate_list_type"]
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          archived_at: string | null
          city: string | null
          comment: string | null
          coordinator: string | null
          created_at: string
          external_id: string | null
          first_shift_at: string | null
          full_name: string
          has_medical_book: boolean | null
          id: string
          invitation_at: string | null
          manager: string | null
          max_tag: string | null
          phone: string | null
          position: string | null
          project: string
          recruiter: string | null
          registration_at: string | null
          salary_card: string | null
          source: string | null
          stage: Database["public"]["Enums"]["candidate_stage"] | null
          telegram_tag: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          comment?: string | null
          coordinator?: string | null
          created_at?: string
          external_id?: string | null
          first_shift_at?: string | null
          full_name: string
          has_medical_book?: boolean | null
          id?: string
          invitation_at?: string | null
          manager?: string | null
          max_tag?: string | null
          phone?: string | null
          position?: string | null
          project: string
          recruiter?: string | null
          registration_at?: string | null
          salary_card?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"] | null
          telegram_tag?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          comment?: string | null
          coordinator?: string | null
          created_at?: string
          external_id?: string | null
          first_shift_at?: string | null
          full_name?: string
          has_medical_book?: boolean | null
          id?: string
          invitation_at?: string | null
          manager?: string | null
          max_tag?: string | null
          phone?: string | null
          position?: string | null
          project?: string
          recruiter?: string | null
          registration_at?: string | null
          salary_card?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"] | null
          telegram_tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["portal_audit_action"]
          actor_id: string | null
          actor_login: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_login: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["portal_audit_action"]
          actor_id?: string | null
          actor_login?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_login?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["portal_audit_action"]
          actor_id?: string | null
          actor_login?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_login?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_audit_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_login_attempts: {
        Row: {
          created_at: string
          id: number
          ip_hash: string | null
          login_hash: string
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          id?: never
          ip_hash?: string | null
          login_hash: string
          succeeded: boolean
        }
        Update: {
          created_at?: string
          id?: never
          ip_hash?: string | null
          login_hash?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      portal_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_users: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          login: string
          password_hash: string
          projects: string[]
          role: Database["public"]["Enums"]["portal_user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          login: string
          password_hash: string
          projects?: string[]
          role: Database["public"]["Enums"]["portal_user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          login?: string
          password_hash?: string
          projects?: string[]
          role?: Database["public"]["Enums"]["portal_user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_import_configs: {
        Row: {
          column_mapping: Json
          created_at: string
          enabled: boolean
          id: string
          parser_key: string
          project: string
          updated_at: string
          version: number
        }
        Insert: {
          column_mapping: Json
          created_at?: string
          enabled?: boolean
          id?: string
          parser_key: string
          project: string
          updated_at?: string
          version?: number
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          parser_key?: string
          project?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      rate_cards: {
        Row: {
          bonuses: string | null
          city: string
          created_at: string
          created_by: string | null
          created_by_login: string | null
          hiring_conditions: string | null
          id: string
          legal_entity: string
          manager: string | null
          notes: string | null
          office_status: string
          payroll_banks: string[]
          project: string
          promotions: string | null
          surcharges: string | null
          updated_at: string
          updated_by: string | null
          updated_by_login: string | null
        }
        Insert: {
          bonuses?: string | null
          city: string
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          hiring_conditions?: string | null
          id?: string
          legal_entity?: string
          manager?: string | null
          notes?: string | null
          office_status?: string
          payroll_banks?: string[]
          project: string
          promotions?: string | null
          surcharges?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
        }
        Update: {
          bonuses?: string | null
          city?: string
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          hiring_conditions?: string | null
          id?: string
          legal_entity?: string
          manager?: string | null
          notes?: string | null
          office_status?: string
          payroll_banks?: string[]
          project?: string
          promotions?: string | null
          surcharges?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cards_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          created_by_login: string | null
          extras: Json
          id: string
          pieces_per_shift: number | null
          position: string
          rate_card_id: string
          rate_hour: number | null
          rate_hour_priority: number | null
          rate_piece: number | null
          rate_shift: number | null
          schedule: string | null
          shift_hours: number
          sort_order: number
          surcharge_per_shift: number | null
          unit: string
          updated_at: string
          updated_by: string | null
          updated_by_login: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          extras?: Json
          id?: string
          pieces_per_shift?: number | null
          position: string
          rate_card_id: string
          rate_hour?: number | null
          rate_hour_priority?: number | null
          rate_piece?: number | null
          rate_shift?: number | null
          schedule?: string | null
          shift_hours?: number
          sort_order?: number
          surcharge_per_shift?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          extras?: Json
          id?: string
          pieces_per_shift?: number | null
          position?: string
          rate_card_id?: string
          rate_hour?: number | null
          rate_hour_priority?: number | null
          rate_piece?: number | null
          rate_shift?: number | null
          schedule?: string | null
          shift_hours?: number
          sort_order?: number
          surcharge_per_shift?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_demand: {
        Row: {
          address: string | null
          city: string
          created_at: string
          demand_date: string
          id: string
          import_id: string | null
          planned_count: number
          position: string
          project: string
          source: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          demand_date: string
          id?: string
          import_id?: string | null
          planned_count: number
          position: string
          project: string
          source?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          demand_date?: string
          id?: string
          import_id?: string | null
          planned_count?: number
          position?: string
          project?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_demand_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "staffing_demand_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_demand_history: {
        Row: {
          action: Database["public"]["Enums"]["staffing_demand_history_action"]
          changed_at: string
          changed_by: string | null
          city: string
          demand_date: string | null
          id: string
          new_comment: string | null
          new_quantity: number | null
          new_status: string | null
          old_comment: string | null
          old_quantity: number | null
          old_status: string | null
          position: string
          project: string
          staffing_demand_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["staffing_demand_history_action"]
          changed_at?: string
          changed_by?: string | null
          city: string
          demand_date?: string | null
          id?: string
          new_comment?: string | null
          new_quantity?: number | null
          new_status?: string | null
          old_comment?: string | null
          old_quantity?: number | null
          old_status?: string | null
          position: string
          project: string
          staffing_demand_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["staffing_demand_history_action"]
          changed_at?: string
          changed_by?: string | null
          city?: string
          demand_date?: string | null
          id?: string
          new_comment?: string | null
          new_quantity?: number | null
          new_status?: string | null
          old_comment?: string | null
          old_quantity?: number | null
          old_status?: string | null
          position?: string
          project?: string
          staffing_demand_id?: string | null
        }
        Relationships: []
      }
      staffing_demand_imports: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_login: string | null
          dry_run: boolean
          duration_ms: number
          error_log: Json
          error_rows: number
          file_name: string
          id: string
          imported_rows: number
          mode: string
          new_rows: number
          parser_key: string
          parser_version: number
          project: string
          status: string
          total_rows: number
          updated_rows: number
          warnings: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          dry_run?: boolean
          duration_ms?: number
          error_log?: Json
          error_rows?: number
          file_name: string
          id?: string
          imported_rows?: number
          mode: string
          new_rows?: number
          parser_key: string
          parser_version: number
          project: string
          status: string
          total_rows?: number
          updated_rows?: number
          warnings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          dry_run?: boolean
          duration_ms?: number
          error_log?: Json
          error_rows?: number
          file_name?: string
          id?: string
          imported_rows?: number
          mode?: string
          new_rows?: number
          parser_key?: string
          parser_version?: number
          project?: string
          status?: string
          total_rows?: number
          updated_rows?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "staffing_demand_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_demand_rows: {
        Row: {
          city: string
          comment: string | null
          created_at: string
          id: string
          position: string
          project: string
          status: string
          updated_at: string
        }
        Insert: {
          city: string
          comment?: string | null
          created_at?: string
          id?: string
          position: string
          project: string
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string
          comment?: string | null
          created_at?: string
          id?: string
          position?: string
          project?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vacancy_attachments: {
        Row: {
          created_at: string
          id: string
          section_id: string | null
          sort_order: number
          title: string
          type: string
          url: string
          vacancy_project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          section_id?: string | null
          sort_order?: number
          title: string
          type?: string
          url: string
          vacancy_project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          section_id?: string | null
          sort_order?: number
          title?: string
          type?: string
          url?: string
          vacancy_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_attachments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vacancy_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_attachments_vacancy_project_id_fkey"
            columns: ["vacancy_project_id"]
            isOneToOne: false
            referencedRelation: "vacancy_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          label: string
          section_id: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          label?: string
          section_id: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          label?: string
          section_id?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vacancy_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_by_login: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          vacancy_project_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_by_login?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          vacancy_project_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_login?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          vacancy_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_history_vacancy_project_id_fkey"
            columns: ["vacancy_project_id"]
            isOneToOne: false
            referencedRelation: "vacancy_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_projects: {
        Row: {
          archived_at: string | null
          category_option_id: string | null
          created_at: string
          created_by: string | null
          created_by_login: string | null
          id: string
          title: string
          updated_at: string
          updated_by: string | null
          updated_by_login: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          category_option_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          id?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
          version?: number
        }
        Update: {
          archived_at?: string | null
          category_option_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_login?: string | null
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_login?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_projects_category_option_id_fkey"
            columns: ["category_option_id"]
            isOneToOne: false
            referencedRelation: "candidate_list_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_projects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_sections: {
        Row: {
          archived_at: string | null
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          sort_order: number
          title: string
          updated_at: string
          vacancy_project_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          vacancy_project_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          vacancy_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_sections_vacancy_project_id_fkey"
            columns: ["vacancy_project_id"]
            isOneToOne: false
            referencedRelation: "vacancy_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      addresses_document_links_valid: {
        Args: { p_links: Json }
        Returns: boolean
      }
      portal_admin_create_user: {
        Args: {
          p_full_name: string
          p_is_active?: boolean
          p_login: string
          p_password: string
          p_projects: string[]
          p_role: Database["public"]["Enums"]["portal_user_role"]
        }
        Returns: Json
      }
      portal_admin_list_audit: {
        Args: { p_limit?: number }
        Returns: {
          action: Database["public"]["Enums"]["portal_audit_action"]
          actor_login: string
          created_at: string
          details: Json
          id: string
          target_login: string
        }[]
      }
      portal_admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string
          login: string
          projects: string[]
          role: Database["public"]["Enums"]["portal_user_role"]
          updated_at: string
        }[]
      }
      portal_admin_login_available: {
        Args: { p_login: string }
        Returns: boolean
      }
      portal_admin_set_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: Json
      }
      portal_admin_set_user_active: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: Json
      }
      portal_admin_update_user: {
        Args: {
          p_full_name: string
          p_projects: string[]
          p_role: Database["public"]["Enums"]["portal_user_role"]
          p_user_id: string
        }
        Returns: Json
      }
      portal_assert_password: {
        Args: { p_password: string }
        Returns: undefined
      }
      portal_bootstrap_admin: {
        Args: { p_full_name: string; p_login: string; p_password: string }
        Returns: Json
      }
      portal_can: { Args: { p_section: string }; Returns: boolean }
      portal_current_session_id: { Args: never; Returns: string }
      portal_current_user_id: { Args: never; Returns: string }
      portal_duplicate_vacancy_project: {
        Args: { p_project_id: string }
        Returns: string
      }
      portal_has_project: { Args: { p_project: string }; Returns: boolean }
      portal_has_rate_card_project: {
        Args: { p_rate_card_id: string }
        Returns: boolean
      }
      portal_jwt_claim: { Args: { p_claim: string }; Returns: string }
      portal_login: {
        Args: {
          p_ip?: string
          p_login: string
          p_password: string
          p_user_agent?: string
        }
        Returns: Json
      }
      portal_logout: { Args: { p_token: string }; Returns: undefined }
      portal_purge_login_attempts: {
        Args: { p_keep?: string }
        Returns: number
      }
      portal_require_admin: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          login: string
          password_hash: string
          projects: string[]
          role: Database["public"]["Enums"]["portal_user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "portal_users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      portal_role_sections: {
        Args: { p_role: Database["public"]["Enums"]["portal_user_role"] }
        Returns: string[]
      }
      portal_save_vacancy_project_tree: {
        Args: {
          p_expected_version: number
          p_payload: Json
          p_project_id: string
        }
        Returns: Json
      }
      portal_session_context: { Args: { p_token: string }; Returns: Json }
      portal_user_json: {
        Args: { p_user: Database["public"]["Tables"]["portal_users"]["Row"] }
        Returns: Json
      }
      search_vacancy_projects: { Args: { p_query: string }; Returns: string[] }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      candidate_list_type:
        | "recruiter"
        | "manager"
        | "coordinator"
        | "city"
        | "position"
        | "project"
        | "legal_entity"
        | "vacancy_category"
      candidate_project:
        | "Самокат"
        | "Купер"
        | "ДонатсКофе"
        | "Яндекс Лавка"
        | "Яндекс РБ"
        | "Газпромнефть"
        | "Евроторг"
        | "Мастер Деливери"
        | "Мастер Деливери Таксопарк"
        | "Азбука вкуса"
        | "Бургер кинг Россия"
        | "Далли"
      candidate_stage:
        | "Прибыл на проект"
        | "Отработал 1 смену"
        | "Отработал 10 смен"
        | "Завершил вахту"
      portal_audit_action:
        | "user_created"
        | "user_updated"
        | "user_role_changed"
        | "user_password_changed"
        | "user_activated"
        | "user_deactivated"
        | "login_success"
        | "login_failed"
        | "logout"
      portal_user_role: "head" | "coordinator" | "manager" | "recruiter"
      staffing_demand_history_action: "insert" | "update" | "delete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      candidate_list_type: [
        "recruiter",
        "manager",
        "coordinator",
        "city",
        "position",
        "project",
        "legal_entity",
        "vacancy_category",
      ],
      candidate_project: [
        "Самокат",
        "Купер",
        "ДонатсКофе",
        "Яндекс Лавка",
        "Яндекс РБ",
        "Газпромнефть",
        "Евроторг",
        "Мастер Деливери",
        "Мастер Деливери Таксопарк",
        "Азбука вкуса",
        "Бургер кинг Россия",
        "Далли",
      ],
      candidate_stage: [
        "Прибыл на проект",
        "Отработал 1 смену",
        "Отработал 10 смен",
        "Завершил вахту",
      ],
      portal_audit_action: [
        "user_created",
        "user_updated",
        "user_role_changed",
        "user_password_changed",
        "user_activated",
        "user_deactivated",
        "login_success",
        "login_failed",
        "logout",
      ],
      portal_user_role: ["head", "coordinator", "manager", "recruiter"],
      staffing_demand_history_action: ["insert", "update", "delete"],
    },
  },
} as const
