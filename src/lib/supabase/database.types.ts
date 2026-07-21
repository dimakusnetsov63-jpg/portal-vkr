// Hand-authored to match supabase/migrations/20260721133910_create_candidates_table.sql.
// Once the CLI is linked and the migration is applied, replace this file with the
// real output of:
//   npx supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
// The shape below intentionally matches that command's output format so the
// regeneration is a drop-in replacement.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      candidates: {
        Row: {
          id: string;
          external_id: string | null;
          full_name: string;
          project: Database["public"]["Enums"]["candidate_project"];
          city: string | null;
          stage: Database["public"]["Enums"]["candidate_stage"] | null;
          recruiter: string | null;
          manager: string | null;
          coordinator: string | null;
          source: string | null;
          phone: string | null;
          telegram_tag: string | null;
          max_tag: string | null;
          comment: string | null;
          has_medical_book: boolean | null;
          salary_card: string | null;
          invitation_at: string | null;
          registration_at: string | null;
          first_shift_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          full_name: string;
          project: Database["public"]["Enums"]["candidate_project"];
          city?: string | null;
          stage?: Database["public"]["Enums"]["candidate_stage"] | null;
          recruiter?: string | null;
          manager?: string | null;
          coordinator?: string | null;
          source?: string | null;
          phone?: string | null;
          telegram_tag?: string | null;
          max_tag?: string | null;
          comment?: string | null;
          has_medical_book?: boolean | null;
          salary_card?: string | null;
          invitation_at?: string | null;
          registration_at?: string | null;
          first_shift_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          full_name?: string;
          project?: Database["public"]["Enums"]["candidate_project"];
          city?: string | null;
          stage?: Database["public"]["Enums"]["candidate_stage"] | null;
          recruiter?: string | null;
          manager?: string | null;
          coordinator?: string | null;
          source?: string | null;
          phone?: string | null;
          telegram_tag?: string | null;
          max_tag?: string | null;
          comment?: string | null;
          has_medical_book?: boolean | null;
          salary_card?: string | null;
          invitation_at?: string | null;
          registration_at?: string | null;
          first_shift_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
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
        | "Далли";
      candidate_stage: "Прибыл на проект" | "Отработал 1 смену" | "Отработал 10 смен" | "Завершил вахту";
    };
    CompositeTypes: Record<string, never>;
  };
};
