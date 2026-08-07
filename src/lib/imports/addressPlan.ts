import type { DemandImportRow, ImportMode } from "./types";
import { EMPTY_CONDITIONS, type ImportedConditions } from "./mapping/normalizeConditions";
import type { ImportPreviewRow } from "./preview";
import type { AddressInsert, AddressRow, AddressUpdate } from "../supabase/addresses.types";

/** One staffing object as the import understands it: a place + a role, plus how many people it needs and the working conditions the file described. */
export type ImportedObject = {
  project: string;
  city: string;
  position: string;
  address: string;
  required: number;
  conditions: ImportedConditions;
};

/** What an import intends to write: cards to create, patches for cards it matched, and — in `sync` mode — cards to zero out because the file no longer mentions them. */
export type AddressWritePlan = {
  creates: AddressInsert[];
  updates: { id: string; patch: AddressUpdate }[];
  zeroes: { id: string; patch: AddressUpdate }[];
  /** Заведённые вручную карточки, которых нет в файле: `sync` их не трогает, но о них стоит сказать пользователю. */
  skippedManual: number;
  /** Человекочитаемая версия creates/updates/zeroes для предпросмотра в UI — что именно изменится, а не только счётчики. */
  preview: ImportPreviewRow[];
};

/**
 * Collapses parsed rows into one entry per (project, city, position,
 * address), summing `demand`. This is what makes "один адрес = один
 * требуемый человек на тикет" work: the Lavka export has one row per open
 * ticket, so three tickets for «Кладовщик» at the same darkstore become one
 * object needing three people. The row's date is intentionally not part of
 * the key — an address card has no date dimension.
 *
 * Rows without an address are skipped: a card cannot exist without
 * `full_address`. importDemand.ts reports those as row errors before
 * calling this.
 */
export function aggregateByObject(rows: DemandImportRow[]): ImportedObject[] {
  const byKey = new Map<string, ImportedObject>();
  for (const row of rows) {
    if (!row.address) continue;
    const key = objectKey(row.project, row.city, row.position, row.address);
    const existing = byKey.get(key);
    if (existing) {
      existing.required += row.demand;
      existing.conditions = mergeConditions(existing.conditions, row.conditions);
    } else {
      byKey.set(key, {
        project: row.project,
        city: row.city,
        position: row.position,
        address: row.address,
        required: row.demand,
        conditions: row.conditions ?? EMPTY_CONDITIONS,
      });
    }
  }
  return [...byKey.values()];
}

/**
 * Условия нескольких тикетов одного объекта. Тикеты на один адрес обычно
 * описывают его одинаково, но заполнены неравномерно: у одного указано
 * метро, у другого график. Побеждает первое непустое значение — так объект
 * собирает максимум того, что известно, и ни один тикет не «стирает»
 * данные соседнего. Особенности объединяются множеством.
 */
function mergeConditions(base: ImportedConditions, next: ImportedConditions | undefined): ImportedConditions {
  if (!next) return base;
  return {
    metro: base.metro ?? next.metro,
    scheduleType: base.scheduleType ?? next.scheduleType,
    shiftType: base.shiftType ?? next.shiftType,
    features: [...new Set([...base.features, ...next.features])],
  };
}

/** Match key for "is this file row the same staffing object as that card?". Case-insensitive so «МСК Снежная 20» and «МСК снежная 20» don't become two cards. */
export function objectKey(project: string, city: string, position: string, address: string): string {
  return [project, city, position, address].map((part) => part.trim().toLowerCase()).join(" ");
}

/**
 * Splits aggregated objects into cards to create, cards to update and — in
 * `sync` mode — cards to zero out.
 *
 * "Заменить" sets required_count to the file's number; "Добавить" adds it to
 * whatever the card already had; "Синхронизировать" behaves like "Заменить"
 * and additionally zeroes every card of the project the file did not
 * mention. Cards are matched in memory rather than via a DB unique
 * constraint — public.addresses has none, because it may already contain
 * manually-created duplicates (see the 20260807100000 migration).
 *
 * `project` scopes `sync`'s zeroing defensively, on top of importDemand.ts
 * already passing in only that project's cards
 * (`listActiveAddressesForProject`). Without this, a caller bug that leaked
 * another project's card into `existingCards` would zero it — nothing else
 * here checks the card's project before deciding "the file didn't mention
 * this, zero it". Create/update matching doesn't need the same guard:
 * `objectKey` already includes `project`, so a card from another project
 * simply never matches an object and is left alone by that path alone.
 */
export function planAddressWrites(
  objects: ImportedObject[],
  existingCards: AddressRow[],
  mode: ImportMode,
  project: string,
): AddressWritePlan {
  const cardByKey = new Map<string, AddressRow>();
  for (const card of existingCards) {
    // Карточка без специализации не может совпасть со строкой файла — там
    // должность есть всегда (её отсутствие отсекает validateRow).
    if (!card.position) continue;
    cardByKey.set(objectKey(card.project, card.city, card.position, card.full_address), card);
  }

  const creates: AddressInsert[] = [];
  const updates: { id: string; patch: AddressUpdate }[] = [];
  const preview: ImportPreviewRow[] = [];
  const matchedCardIds = new Set<string>();

  for (const object of objects) {
    const card = cardByKey.get(objectKey(object.project, object.city, object.position, object.address));
    if (card) {
      matchedCardIds.add(card.id);
      const required = mode === "add" ? card.required_count + object.required : object.required;
      updates.push({
        id: card.id,
        patch: {
          required_count: required,
          ...conditionsPatchFor(card, object.conditions),
        },
      });
      preview.push({
        action: "update",
        project: object.project,
        city: object.city,
        position: object.position,
        address: object.address,
        required,
        previousRequired: card.required_count,
      });
    } else {
      // Район, тип объекта, статус, приоритет, укомплектованность в выгрузке
      // отсутствуют — остаются дефолтными, координатор дозаполняет их
      // вручную в карточке адреса.
      creates.push({
        project: object.project,
        city: object.city,
        position: object.position,
        full_address: object.address,
        required_count: object.required,
        ...(object.conditions.metro ? { metro: object.conditions.metro } : {}),
        ...(object.conditions.scheduleType ? { schedule_type: object.conditions.scheduleType } : {}),
        ...(object.conditions.shiftType ? { shift_type: object.conditions.shiftType } : {}),
        ...(object.conditions.features.length > 0 ? { features: object.conditions.features } : {}),
      });
      preview.push({
        action: "create",
        project: object.project,
        city: object.city,
        position: object.position,
        address: object.address,
        required: object.required,
      });
    }
  }

  const { zeroes, skippedManual, zeroPreview } = planZeroes(existingCards, matchedCardIds, mode, project);
  return { creates, updates, zeroes, skippedManual, preview: [...preview, ...zeroPreview] };
}

/**
 * Карточки проекта, которых в файле не оказалось. Выгрузка тикетов
 * показывает только открытые позиции: когда объект укомплектовали, он из
 * неё просто исчезает — и без этого шага карточка навсегда сохраняет старое
 * «Требуется».
 *
 * Обнуляется `required_count`, а не архивируется и не удаляется карточка:
 * объект физически существует и, скорее всего, вернётся в следующей
 * выгрузке вместе со всем, что координатор заполнил руками.
 *
 * Не трогаются:
 * - карточки **другого проекта** (`card.project !== project`) — sync
 *   работает только в рамках выбранного проекта, никогда по всей базе;
 *   этот guard защищает саму функцию, а не полагается на то, что вызывающий
 *   код уже передал только нужные карточки;
 * - карточки, заведённые вручную (`source !== 'excel'`) — файл им не
 *   источник истины, молча обнулять чужую работу нельзя; они считаются
 *   отдельно и показываются пользователю;
 * - карточки без специализации — они в принципе не участвуют в
 *   сопоставлении, значит «отсутствием в файле» это не является;
 * - карточки, у которых `required_count` и так 0 — обнулять нечего, и
 *   лишний запрос только раздул бы счётчик в отчёте.
 */
function planZeroes(
  existingCards: AddressRow[],
  matchedCardIds: Set<string>,
  mode: ImportMode,
  project: string,
): { zeroes: { id: string; patch: AddressUpdate }[]; skippedManual: number; zeroPreview: ImportPreviewRow[] } {
  if (mode !== "sync") return { zeroes: [], skippedManual: 0, zeroPreview: [] };

  const zeroes: { id: string; patch: AddressUpdate }[] = [];
  const zeroPreview: ImportPreviewRow[] = [];
  let skippedManual = 0;

  for (const card of existingCards) {
    if (card.project !== project) continue;
    if (matchedCardIds.has(card.id) || !card.position || card.required_count === 0) continue;
    if (card.source !== "excel") {
      skippedManual++;
      continue;
    }
    zeroes.push({ id: card.id, patch: { required_count: 0 } });
    zeroPreview.push({
      action: "zero",
      project: card.project,
      city: card.city,
      position: card.position,
      address: card.full_address,
      required: 0,
      previousRequired: card.required_count,
    });
  }

  return { zeroes, skippedManual, zeroPreview };
}

/**
 * Условия для **уже существующей** карточки: импорт заполняет только пустые
 * поля и никогда не перезаписывает то, что заполнено. Иначе очередная
 * загрузка затирала бы правки координатора — он мог уточнить метро или
 * поменять график, а выгрузка тикетов этого не знает. `required_count` под
 * это правило не подпадает: он и есть то число, ради которого делается
 * импорт (см. режимы «Заменить»/«Добавить»).
 *
 * Особенности (`features`) не заменяются, а дополняются: чекбоксы,
 * проставленные руками, остаются.
 */
function conditionsPatchFor(card: AddressRow, conditions: ImportedConditions): AddressUpdate {
  const patch: AddressUpdate = {};
  if (!card.metro && conditions.metro) patch.metro = conditions.metro;
  if (!card.schedule_type && conditions.scheduleType) patch.schedule_type = conditions.scheduleType;
  if (!card.shift_type && conditions.shiftType) patch.shift_type = conditions.shiftType;

  const missingFeatures = conditions.features.filter((slug) => !card.features.includes(slug));
  if (missingFeatures.length > 0) patch.features = [...card.features, ...missingFeatures];

  return patch;
}
