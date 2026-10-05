import type { AddressObjectType, AddressRow, AddressStatus } from "@/lib/supabase/addresses.types";

/** Active filter state for the addresses registry. */
export interface AddressFilters {
  /** Free-text query, matched against several fields at once — see below. */
  search: string;
  /** Exact project match; empty string means "all projects". */
  project: string;
  /** Exact city match; empty string means "all cities". */
  city: string;
  /** Exact position/specialization match; empty string means "all". */
  position: string;
  /** Exact district match; empty string means "all districts". */
  district: string;
  /** Exact metro match; empty string means "all metro stations". */
  metro: string;
  /** Exact object type match; empty string means "all types". */
  objectType: AddressObjectType | "";
  /** Exact status match; empty string means "all statuses". */
  status: AddressStatus | "";
  /** Exact priority match; 0 means "all priorities" (priority itself is never 0). */
  priority: number;
  /** Exact coordinator match; empty string means "all coordinators". */
  coordinator: string;
  /** Вкладка «Активные/Архив». См. `isOutOfWork` — «Архив» показывает не только архивные. */
  showArchived: boolean;
}

/**
 * Карточка не в работе: либо убрана в архив руками, либо по ней сейчас никого
 * не ищут (`required_count = 0`). Обнулённые попадают во вкладку «Архив»
 * вместе с архивными, чтобы рабочий список состоял только из объектов, по
 * которым реально идёт набор.
 *
 * Это **только разделение на вкладки**, а не архивирование: `archived_at` у
 * обнулённой карточки остаётся пустым. Иначе импорт перестал бы её находить
 * (`listActiveAddressesForProject` читает только неархивные) и при возвращении
 * объекта в выгрузку завёл бы дубликат вместо обновления. А так объект, по
 * которому снова появилась потребность, сам возвращается в «Активные» —
 * восстанавливать руками нечего.
 */
export function isOutOfWork(address: AddressRow): boolean {
  return Boolean(address.archived_at) || address.required_count === 0;
}

/**
 * Pure filtering of the address list. No React, no Supabase — everything
 * (search, filters, sort) runs over the already-loaded list in memory, per
 * the addresses ТЗ performance requirement.
 *
 * `search` matches across several fields at once (full address, metro,
 * district, city, coordinator, site manager) — the user should not have to
 * pick a field to search a known value in.
 */
export function filterAddresses(addresses: AddressRow[], filters: AddressFilters): AddressRow[] {
  const q = filters.search.trim().toLowerCase();
  return addresses.filter((a) => {
    if (filters.showArchived !== isOutOfWork(a)) return false;
    if (filters.project && a.project !== filters.project) return false;
    if (filters.city && a.city !== filters.city) return false;
    if (filters.position && (a.position ?? "") !== filters.position) return false;
    if (filters.district && (a.district ?? "") !== filters.district) return false;
    if (filters.metro && (a.metro ?? "") !== filters.metro) return false;
    if (filters.objectType && a.object_type !== filters.objectType) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.priority && a.priority !== filters.priority) return false;
    if (filters.coordinator && (a.coordinator_name ?? "") !== filters.coordinator) return false;
    if (q) {
      const haystack = [a.full_address, a.metro, a.district, a.city, a.coordinator_name, a.site_manager_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
