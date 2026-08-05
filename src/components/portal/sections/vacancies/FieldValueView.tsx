import { Fragment, type ReactNode } from "react";
import type { InlineToken } from "./renderFieldValue";
import { parseRichText } from "./renderFieldValue";
import type { VacancyFieldType } from "@/lib/supabase/vacancyProjects.types";
import styles from "./VacancyDetail.module.css";

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function renderTokens(tokens: InlineToken[]) {
  return tokens.map((token, i) => {
    switch (token.kind) {
      case "bold":
        return <strong key={i}>{token.text}</strong>;
      case "italic":
        return <em key={i}>{token.text}</em>;
      case "link":
        return isHttpUrl(token.url) ? (
          <a key={i} href={token.url} target="_blank" rel="noopener noreferrer">
            {token.text}
          </a>
        ) : (
          <Fragment key={i}>{token.text}</Fragment>
        );
      default:
        return <Fragment key={i}>{token.text}</Fragment>;
    }
  });
}

/** Оборачивает совпадения с `query` в `<mark>` — только для простого текста (rich_text/link не подсвечиваются, чтобы не ломать разбор markup/URL). */
function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(needle, cursor);
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<mark key={index}>{text.slice(index, index + needle.length)}</mark>);
    cursor = index + needle.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

/** Рендер значения поля по его field_type. Пустое значение — ничего (карточка сама решает, показывать ли поле). `highlightQuery` подсвечивает совпадения поиска внутри вакансии — только в простых текстовых типах. */
export function FieldValueView({
  fieldType,
  value,
  highlightQuery,
}: {
  fieldType: VacancyFieldType;
  value: string;
  highlightQuery?: string;
}) {
  if (value.trim() === "") return null;

  if (fieldType === "rich_text") {
    const blocks = parseRichText(value);
    return (
      <div className={styles.richText}>
        {blocks.map((block, i) =>
          block.kind === "list" ? (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{renderTokens(item)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{renderTokens(block.tokens)}</p>
          ),
        )}
      </div>
    );
  }

  if (fieldType === "link") {
    return isHttpUrl(value) ? (
      <a className={styles.linkPill} href={value} target="_blank" rel="noopener noreferrer">
        {value}
      </a>
    ) : (
      <p className={styles.plainText}>{value}</p>
    );
  }

  if (fieldType === "checkbox") {
    return <p className={styles.plainText}>{value === "true" ? "Да" : "Нет"}</p>;
  }

  // text / textarea / number / date / select (select falls back to plain text — см. vacancy_fields.field_type).
  return <p className={styles.plainText}>{highlightQuery ? highlight(value, highlightQuery) : value}</p>;
}
