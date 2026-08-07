/**
 * One line of "what this import will actually do to public.addresses" —
 * shown to the user before/after the write, not just the totals. ТЗ §5
 * asks for a preview of the parsed data, not only counters and errors.
 */
export type ImportPreviewAction = "create" | "update" | "zero";

export type ImportPreviewRow = {
  action: ImportPreviewAction;
  project: string;
  city: string;
  position: string;
  address: string;
  /** required_count после записи. */
  required: number;
  /** required_count до записи — отсутствует для `create`, там карточки не существовало. */
  previousRequired?: number;
};
