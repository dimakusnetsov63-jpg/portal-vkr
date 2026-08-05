import type { Database } from "./database.types";
import type { ColumnMapping } from "@/lib/imports/types";

type ProjectImportConfigsTable = Database["public"]["Tables"]["project_import_configs"];

/** column_mapping is Json in the generated type — the app always reads/writes the concrete ColumnMapping shape, same convention as AddressRow.document_links. */
export type ProjectImportConfigRow = Omit<ProjectImportConfigsTable["Row"], "column_mapping"> & {
  column_mapping: ColumnMapping;
};
