/**
 * Проверка `npm audit` с учётом реестра исключений из docs/SECURITY.md.
 *
 * ЗАЧЕМ. `npm audit --audit-level=high` не умеет игнорировать конкретное
 * advisory: одна находка `high` без исправления (EX-004, `braces` внутри
 * `eslint-config-next`) делала джобу `dependency-audit` красной навсегда, и
 * настоящая новая уязвимость потерялась бы в ней. Скрипт падает только на
 * `high`/`critical`, которых нет в `ACCEPTED` ниже.
 *
 * КАК. Читает `npm audit --json` со stdin. Смотрит только на сами advisory
 * (объекты в `via`), а не на пакеты-цепочки вроде `micromatch` → `braces`:
 * цепочка красная ровно тогда, когда красное advisory в её корне.
 *
 * Добавлять сюда GHSA можно только вместе с записью в реестре
 * docs/SECURITY.md (чем вызвано, почему не эксплуатируется, когда
 * пересмотреть).
 *
 *   npm audit --json | node scripts/audit-check.mjs
 */

/** GHSA → номер записи в реестре docs/SECURITY.md. */
const ACCEPTED = new Map([["GHSA-vfj7-8cjw-p6xm", "EX-004"]]);
const BLOCKING = new Set(["high", "critical"]);

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const report = JSON.parse(Buffer.concat(chunks).toString("utf8"));

if (report.error) {
  console.error("npm audit не отработал:", report.error.summary ?? report.error);
  process.exit(2);
}

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === "string") continue;
    const ghsa = via.url?.split("/").pop() ?? String(via.source);
    advisories.set(ghsa, { ghsa, severity: via.severity, name: via.name, title: via.title });
  }
}

const blocking = [];
for (const advisory of advisories.values()) {
  const accepted = ACCEPTED.get(advisory.ghsa);
  const mark = accepted ? `принято (${accepted})` : BLOCKING.has(advisory.severity) ? "БЛОКИРУЕТ" : "ниже порога";
  console.log(`${advisory.severity.padEnd(8)} ${advisory.name} ${advisory.ghsa} — ${mark}: ${advisory.title}`);
  if (!accepted && BLOCKING.has(advisory.severity)) blocking.push(advisory);
}

const stale = [...ACCEPTED.keys()].filter((ghsa) => !advisories.has(ghsa));
for (const ghsa of stale) {
  console.log(`Исключение ${ACCEPTED.get(ghsa)} (${ghsa}) больше не встречается — запись можно закрыть.`);
}

if (blocking.length > 0) {
  console.error(`\n${blocking.length} high/critical вне реестра исключений docs/SECURITY.md.`);
  process.exit(1);
}
console.log("\nНичего выше порога вне реестра исключений.");
