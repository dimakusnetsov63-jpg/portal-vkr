import type { CandidateProject } from "./candidates.types";

/**
 * Типы public.addresses.
 *
 * Написаны вручную, как portalAuth.types.ts — миграция
 * (20260729130000_create_addresses.sql) ещё не применена к боевой БД, а
 * регенерация database.types.ts требует доступа к ней (`supabase gen types
 * typescript --linked`). После применения и регенерации `AddressesDatabase`
 * можно удалить и определить Address*-алиасы через `Database["public"]
 * ["Tables"]["addresses"]`, как в candidates.types.ts.
 *
 * ВАЖНО: Row/Insert/Update ниже — вложенные object-literal типы внутри
 * `AddressesDatabase`, а не отдельные `interface`. Это не стилистика:
 * supabase-js резолвит `.from("addresses")` через условный тип
 * `Schema extends GenericSchema`, и при подстановке именованного `interface`
 * в качестве `Row`/`Insert`/`Update` эта проверка почему-то не проходит —
 * `Table` откатывается к `never`, и `.insert()`/`.update()` перестают
 * типизироваться (`Argument ... not assignable to parameter of type
 * 'never[]'`), хотя структурно типы идентичны. С вложенным object-literal
 * (как в реальном сгенерированном `database.types.ts`) всё резолвится
 * штатно — поэтому именно так и оставлено, `Address*`-типы ниже выведены
 * из `AddressesDatabase`, а не наоборот.
 *
 * `object_type`/`status`/`schedule_type`/`shift_type`/`payment_type` в БД —
 * `CHECK`, не enum (см. комментарий в миграции и schema.md про
 * staffing_demand_rows.status — тот же принцип: список проще расширить без
 * `ALTER TYPE ... ADD VALUE`). Сужение до конкретных строк ниже — только на
 * уровне приложения, как `DemandRowStatus` в demandRowMeta.ts.
 */

export type AddressObjectType =
  | "darkstore"
  | "shop"
  | "warehouse"
  | "pvz"
  | "restaurant"
  | "production"
  | "office"
  | "other";

export type AddressStatus = "stop" | "reserve" | "hiring_standby" | "any_candidate" | "unrestricted";

export type AddressScheduleType = "2/2" | "3/3" | "5/2" | "6/1" | "7/0" | "flexible" | "parttime";

export type AddressShiftType = "day" | "night" | "mixed";

export type AddressPaymentType = "hourly" | "per_shift" | "per_order";

/** Один пункт "Документов" — только внешняя ссылка, загрузки файлов нет (см. requirements/addresses.md). */
export interface AddressDocumentLink {
  id: string;
  title: string;
  url: string;
  type: string;
}

/**
 * Schema for a typed Supabase client scoped to `public.addresses` only —
 * same trick as `PortalAuthDatabase` in portalAuth.types.ts: the table
 * doesn't exist yet in the generated `Database` type (migration not applied
 * to the real project), so `createClient<Database>()` cannot type
 * `.from("addresses")`. Once the migration is applied and types
 * regenerated, `addressesRepo.ts` can switch back to the shared
 * `createClient()` and this type can be deleted.
 */
export type AddressesDatabase = {
  // Matches Database["__InternalSupabase"] in database.types.ts — without
  // it, supabase-js resolves the wrong createClient() overload.
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string;
          project: CandidateProject;
          city: string;
          position: string | null;
          full_address: string;
          metro: string | null;
          district: string | null;
          latitude: number | null;
          longitude: number | null;
          object_type: AddressObjectType;
          required_count: number;
          staffed_count: number;
          planned_start_count: number;
          in_progress_count: number;
          status: AddressStatus;
          priority: number;
          schedule_type: AddressScheduleType | null;
          shift_type: AddressShiftType | null;
          shift_times: string[];
          payment_type: AddressPaymentType | null;
          payment_amount: number | null;
          coordinator_name: string | null;
          coordinator_phone: string | null;
          coordinator_telegram: string | null;
          site_manager_name: string | null;
          site_manager_phone: string | null;
          coordinator_comment: string | null;
          features: string[];
          document_links: AddressDocumentLink[];
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          created_by_login: string | null;
          updated_by: string | null;
          updated_by_login: string | null;
        };
        Insert: {
          project: CandidateProject;
          city: string;
          full_address: string;
          position?: string | null;
          metro?: string | null;
          district?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          object_type?: AddressObjectType;
          required_count?: number;
          staffed_count?: number;
          planned_start_count?: number;
          in_progress_count?: number;
          status?: AddressStatus;
          priority?: number;
          schedule_type?: AddressScheduleType | null;
          shift_type?: AddressShiftType | null;
          shift_times?: string[];
          payment_type?: AddressPaymentType | null;
          payment_amount?: number | null;
          coordinator_name?: string | null;
          coordinator_phone?: string | null;
          coordinator_telegram?: string | null;
          site_manager_name?: string | null;
          site_manager_phone?: string | null;
          coordinator_comment?: string | null;
          features?: string[];
          document_links?: AddressDocumentLink[];
          archived_at?: string | null;
        };
        Update: {
          project?: CandidateProject;
          city?: string;
          full_address?: string;
          position?: string | null;
          metro?: string | null;
          district?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          object_type?: AddressObjectType;
          required_count?: number;
          staffed_count?: number;
          planned_start_count?: number;
          in_progress_count?: number;
          status?: AddressStatus;
          priority?: number;
          schedule_type?: AddressScheduleType | null;
          shift_type?: AddressShiftType | null;
          shift_times?: string[];
          payment_type?: AddressPaymentType | null;
          payment_amount?: number | null;
          coordinator_name?: string | null;
          coordinator_phone?: string | null;
          coordinator_telegram?: string | null;
          site_manager_name?: string | null;
          site_manager_phone?: string | null;
          coordinator_comment?: string | null;
          features?: string[];
          document_links?: AddressDocumentLink[];
          archived_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/** A row from public.addresses, as returned by SELECT. */
export type AddressRow = AddressesDatabase["public"]["Tables"]["addresses"]["Row"];

/** Payload accepted by INSERT into public.addresses. Only project/city/full_address are required — the rest has a DB default or is nullable. */
export type AddressInsert = AddressesDatabase["public"]["Tables"]["addresses"]["Insert"];

/** Payload accepted by UPDATE on public.addresses. `created_by*`/`updated_by*` are never part of a patch — the trigger sets them from auth.uid(). */
export type AddressUpdate = AddressesDatabase["public"]["Tables"]["addresses"]["Update"];
