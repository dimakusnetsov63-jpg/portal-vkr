import type { Database } from "./database.types";

/**
 * Типы public.addresses.
 *
 * Row/Insert/Update выведены из `database.types.ts`, как и в остальных
 * `*.types.ts` (миграция `20260729130000_create_addresses.sql` применена к
 * боевой БД, типы регенерированы) — см. `docs/database/migrations.md`.
 *
 * `object_type`/`status`/`schedule_type`/`shift_type`/`payment_type` в БД —
 * `CHECK`, не enum (см. миграцию и `schema.md` про `staffing_demand_rows.status`
 * — тот же принцип: список проще расширить без `ALTER TYPE ... ADD VALUE`),
 * поэтому в сгенерированных типах это просто `string`. Сужение до конкретных
 * литералов ниже — только на уровне приложения, тот же приём, что
 * `DemandRowStatus` в `demandRowMeta.ts`.
 *
 * `document_links` в сгенерированном типе — `Json` (jsonb-колонка типизируется
 * максимально широко). Приложение всегда читает/пишет туда конкретную форму
 * `{id, title, url, type}[]`, поэтому `AddressRow`/`AddressInsert`/`AddressUpdate`
 * переопределяют это одно поле поверх сгенерированного — остальное выводится
 * без изменений.
 */

type AddressesTable = Database["public"]["Tables"]["addresses"];

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

/** A row from public.addresses, as returned by SELECT. */
export type AddressRow = Omit<AddressesTable["Row"], "document_links"> & {
  document_links: AddressDocumentLink[];
};

/** Payload accepted by INSERT into public.addresses. Only project/city/full_address are required — the rest has a DB default or is nullable. */
export type AddressInsert = Omit<AddressesTable["Insert"], "document_links"> & {
  document_links?: AddressDocumentLink[];
};

/** Payload accepted by UPDATE on public.addresses. `created_by*`/`updated_by*` are never part of a patch — the trigger sets them from auth.uid(). */
export type AddressUpdate = Omit<AddressesTable["Update"], "document_links"> & {
  document_links?: AddressDocumentLink[];
};
