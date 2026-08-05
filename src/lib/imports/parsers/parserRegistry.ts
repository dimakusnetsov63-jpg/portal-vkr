import type { DemandParser } from "./DemandParser";
import { parserBkV1 } from "./parser_bk";
import { parserGazpromV1 } from "./parser_gazprom";
import { parserKuperV1 } from "./parser_kuper";
import { parserLavkaV1 } from "./parser_lavka";

/**
 * Registry keyed by `parser_key` (from project_import_configs), not by
 * project name. Adding a new project's real parser = write a new
 * `parser_*.ts` implementing `DemandParser` and add one line here — no
 * change to `importDemand.ts` or the UI. «Лавка» (`parser_lavka.ts`) is the
 * first project with a real, dedicated implementation; БК/Газпром/Купер
 * still use the generic column-mapping parser until their real Excel
 * formats are known.
 */
const PARSERS: readonly DemandParser[] = [parserLavkaV1, parserBkV1, parserGazpromV1, parserKuperV1];

const PARSERS_BY_KEY = new Map(PARSERS.map((parser) => [parser.parserKey, parser]));

/** Looks up a registered parser by its `parser_key` (project_import_configs.parser_key). Throws if no parser is registered under that key — a config pointing at an unregistered key is a deployment mistake, not a recoverable per-row error. */
export function getParserByKey(parserKey: string): DemandParser {
  const parser = PARSERS_BY_KEY.get(parserKey);
  if (!parser) throw new Error(`Не найден парсер с ключом «${parserKey}»`);
  return parser;
}
