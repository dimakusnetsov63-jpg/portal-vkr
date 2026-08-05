/**
 * Обёртки выделения markup-символами для панели форматирования над
 * `rich_text`-редактором (Ж/К/список/ссылка). Работает с позициями
 * выделения `<textarea>` (`selectionStart`/`selectionEnd`), а не с React-
 * состоянием — компонент сам решает, что делать с результатом (обновить
 * `value`, восстановить выделение через `ref`).
 */

export interface SelectionEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string = before,
): SelectionEdit {
  const selected = value.slice(selectionStart, selectionEnd);
  const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  return {
    value: next,
    selectionStart: selectionStart + before.length,
    selectionEnd: selectionStart + before.length + selected.length,
  };
}

/** Добавляет/убирает `- ` в начале каждой строки, попавшей в выделение. */
export function toggleBulletLines(value: string, selectionStart: number, selectionEnd: number): SelectionEdit {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextBreak = value.indexOf("\n", selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const allBulleted = lines.every((line) => line.startsWith("- ") || line.trim() === "");
  const nextLines = lines.map((line) => {
    if (line.trim() === "") return line;
    return allBulleted ? line.replace(/^- /, "") : `- ${line}`;
  });
  const nextBlock = nextLines.join("\n");

  return {
    value: value.slice(0, lineStart) + nextBlock + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}

/** Оборачивает выделенный текст в `[текст](url)`; без выделения — вставляет плейсхолдер, который остаётся выделенным для замены. */
export function insertLink(value: string, selectionStart: number, selectionEnd: number, url: string): SelectionEdit {
  const selected = value.slice(selectionStart, selectionEnd) || "текст ссылки";
  const markup = `[${selected}](${url})`;
  const next = value.slice(0, selectionStart) + markup + value.slice(selectionEnd);
  const linkTextStart = selectionStart + 1;
  return {
    value: next,
    selectionStart: linkTextStart,
    selectionEnd: linkTextStart + selected.length,
  };
}
