/**
 * Разбор `vacancy_fields.value` для рендера в `FieldValueView.tsx`
 * (`field_type = rich_text`) — облегчённое подмножество Markdown, а не
 * полноценный парсер: `**жирный**`, `*курсив*`, `[текст](url)`, голый
 * `https://…` и списки через строки `- `/`• `. Чистая функция без React —
 * компонент отвечает за то, как это отрисовать.
 *
 * Ссылки распознаются только по regex, требующему `http(s)://` в самом
 * совпадении — поэтому `javascript:`/`data:`-схемы структурно никогда не
 * становятся `link`-токеном, что бы ни было в исходном тексте.
 */

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "link"; text: string; url: string };

export interface ParagraphBlock {
  kind: "paragraph";
  tokens: InlineToken[];
}

export interface ListBlock {
  kind: "list";
  items: InlineToken[][];
}

export type Block = ParagraphBlock | ListBlock;

const INLINE_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

export function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ kind: "text", text: text.slice(lastIndex, index) });
    }
    const [, bold, italic, linkText, linkUrl, bareUrl] = match;
    if (bold !== undefined) {
      tokens.push({ kind: "bold", text: bold });
    } else if (italic !== undefined) {
      tokens.push({ kind: "italic", text: italic });
    } else if (linkText !== undefined && linkUrl !== undefined) {
      tokens.push({ kind: "link", text: linkText, url: linkUrl });
    } else if (bareUrl !== undefined) {
      tokens.push({ kind: "link", text: bareUrl, url: bareUrl });
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: "text", text: text.slice(lastIndex) });
  }

  return tokens;
}

const BULLET_PREFIX = /^[-•]\s+/;

/** Строки, начинающиеся с `- `/`• `, группируются в список; остальные подряд идущие строки — в один абзац (перенос строк внутри — `\n`, компонент рендерит с `white-space: pre-wrap`). */
export function parseRichText(value: string): Block[] {
  if (value.length === 0) return [];

  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ kind: "paragraph", tokens: parseInlineTokens(paragraphLines.join("\n")) });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({ kind: "list", items: listItems.map((item) => parseInlineTokens(item)) });
    listItems = [];
  }

  for (const rawLine of value.split("\n")) {
    const bulletMatch = rawLine.match(BULLET_PREFIX);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(rawLine.slice(bulletMatch[0].length));
    } else {
      flushList();
      paragraphLines.push(rawLine);
    }
  }
  flushParagraph();
  flushList();

  return blocks;
}
