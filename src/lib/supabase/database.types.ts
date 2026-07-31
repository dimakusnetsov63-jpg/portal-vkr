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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
          project: Database["public"]["Enums"]["candidate_project"]
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
          project: Database["public"]["Enums"]["candidate_project"]
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
          project?: Database["public"]["Enums"]["candidate_project"]
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
          project: Database["public"]["Enums"]["candidate_project"]
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
          project: Database["public"]["Enums"]["candidate_project"]
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
          project?: Database["public"]["Enums"]["candidate_project"]
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
          city: string
          created_at: string
          demand_date: string
          id: string
          planned_count: number
          position: string
          project: Database["public"]["Enums"]["candidate_project"]
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          demand_date: string
          id?: string
          planned_count: number
          position: string
          project: Database["public"]["Enums"]["candidate_project"]
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          demand_date?: string
          id?: string
          planned_count?: number
          position?: string
          project?: Database["public"]["Enums"]["candidate_project"]
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      portal_jwt_claim: { Args: { p_claim: string }; Returns: string }
      portal_login: {
        Args: { p_login: string; p_password: string; p_user_agent?: string }
        Returns: Json
      }
      portal_logout: { Args: { p_token: string }; Returns: undefined }
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
      portal_session_context: { Args: { p_token: string }; Returns: Json }
      portal_user_json: {
        Args: { p_user: Database["public"]["Tables"]["portal_users"]["Row"] }
        Returns: Json
      }
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
  graphql_public: {
    Enums: {},
  },
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
