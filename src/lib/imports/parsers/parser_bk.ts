import { makeGenericColumnParser } from "./genericColumnParser";

/**
 * Временная реализация парсера «БК» — см. комментарий в genericColumnParser.ts.
 * project_import_configs: project='Бургер кинг Россия', parser_key='bk_v1'.
 */
export const parserBkV1 = makeGenericColumnParser("bk_v1");
