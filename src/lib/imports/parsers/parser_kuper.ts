import { makeGenericColumnParser } from "./genericColumnParser";

/**
 * Временная реализация парсера «Купер» — см. комментарий в genericColumnParser.ts.
 * project_import_configs: project='Купер', parser_key='kuper_v1'.
 */
export const parserKuperV1 = makeGenericColumnParser("kuper_v1");
