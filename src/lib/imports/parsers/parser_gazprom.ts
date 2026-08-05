import { makeGenericColumnParser } from "./genericColumnParser";

/**
 * Временная реализация парсера «Газпром» — см. комментарий в genericColumnParser.ts.
 * project_import_configs: project='Газпромнефть', parser_key='gazprom_v1'.
 */
export const parserGazpromV1 = makeGenericColumnParser("gazprom_v1");
