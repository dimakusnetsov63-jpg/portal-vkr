import type { Database } from "./database.types";

/**
 * Типы раздела «Ставки»: public.rate_cards (блок условий «проект + город +
 * юр. лицо») и public.rates (строка тарифа по должности внутри блока).
 *
 * Row/Insert/Update выведены из `database.types.ts` — миграции
 * `20260731100000_rates_list_types.sql`, `20260731100100_create_rates.sql`
 * применены к боевой БД, типы регенерированы (см. docs/database/migrations.md).
 *
 * `unit`/`schedule`/`office_status` в БД — `CHECK`, не enum (см. миграцию и
 * `schema.md` про `staffing_demand_rows.status` — тот же принцип: список
 * проще расширить без `ALTER TYPE ... ADD VALUE`), поэтому в сгенерированных
 * типах это просто `string`. Сужение до конкретных литералов ниже — только
 * на уровне приложения, тот же приём, что `AddressStatus` в addresses.types.ts.
 *
 * `extras` в сгенерированном типе — `Json` (jsonb-колонка типизируется
 * максимально широко). Приложение всегда читает/пишет туда конкретную форму
 * `{id, label, value}[]`, поэтому `RateRow`/`RateInsert`/`RateUpdate`
 * переопределяют это одно поле поверх сгенерированного.
 */

type RateCardsTable = Database["public"]["Tables"]["rate_cards"];
type RatesTable = Database["public"]["Tables"]["rates"];

export type RateUnit = "hour" | "hour_order" | "hour_item" | "order" | "stop" | "shift" | "day" | "route";

export type RateSchedule = "2/2" | "3/3" | "5/2" | "6/1" | "7/0" | "flexible" | "parttime";

export type RateOfficeStatus = "working" | "not_working" | "unknown";

/** Один дополнительный показатель тарифа (оплата за стоп SLA, доплата за вес, топливная карта…). */
export interface RateExtra {
  id: string;
  label: string;
  value: string;
}

/** A row from public.rate_cards, as returned by SELECT. */
export type RateCardRow = RateCardsTable["Row"];

/** Payload accepted by INSERT into public.rate_cards. Only project/city are required — legal_entity defaults to ''. */
export type RateCardInsert = RateCardsTable["Insert"];

/** Payload accepted by UPDATE on public.rate_cards. `created_by*`/`updated_by*` are never part of a patch — the trigger sets them. */
export type RateCardUpdate = RateCardsTable["Update"];

/** A row from public.rates, as returned by SELECT. */
export type RateRow = Omit<RatesTable["Row"], "extras"> & {
  extras: RateExtra[];
};

/** Payload accepted by INSERT into public.rates. `rate_card_id`/`position` are required — the rest has a DB default or is nullable. */
export type RateInsert = Omit<RatesTable["Insert"], "extras"> & {
  extras?: RateExtra[];
};

/** Payload accepted by UPDATE on public.rates. */
export type RateUpdate = Omit<RatesTable["Update"], "extras"> & {
  extras?: RateExtra[];
};
