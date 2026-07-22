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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      candidate_list_type: "recruiter" | "manager" | "coordinator" | "city"
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
      candidate_list_type: ["recruiter", "manager", "coordinator", "city"],
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
    },
  },
} as const
