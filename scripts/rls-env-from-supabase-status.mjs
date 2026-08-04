#!/usr/bin/env node
// H-13 CI helper: maps `supabase status -o env`'s own key names onto the
// RLS_TEST_* names src/testing/rls/env.ts expects, writing them to
// $GITHUB_ENV. Reads raw status text from stdin.
//
// Written to tolerate not knowing the exact key names ahead of time rather
// than guessing once more and waiting for another CI round-trip: tries a
// list of known/plausible variants per field (Supabase has been migrating
// from anon/service_role naming to publishable/secret — this project's own
// production keys already use the new naming, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
// and prints the full raw output either way so a human can see the real
// key names directly in the CI log if every variant misses.
import { appendFileSync } from "node:fs";

const FIELD_KEY_VARIANTS = {
  RLS_TEST_API_URL: ["API_URL"],
  RLS_TEST_ANON_KEY: ["ANON_KEY", "PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"],
  RLS_TEST_SERVICE_ROLE_KEY: ["SERVICE_ROLE_KEY", "SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  RLS_TEST_JWT_SECRET: ["JWT_SECRET"],
};

function parseEnvLines(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    map.set(key, rawValue.replace(/^"(.*)"$/, "$1"));
  }
  return map;
}

const stdin = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
});

console.log("--- raw `supabase status -o env` output (for debugging, not secrets — local ephemeral container only) ---");
console.log(stdin);
console.log("--- end raw output ---");

const parsed = parseEnvLines(stdin);
const githubEnv = process.env.GITHUB_ENV;
if (!githubEnv) throw new Error("GITHUB_ENV is not set — this script is meant to run inside a GitHub Actions step.");

const missing = [];
for (const [targetName, variants] of Object.entries(FIELD_KEY_VARIANTS)) {
  const foundKey = variants.find((v) => parsed.has(v));
  if (!foundKey) {
    missing.push(`${targetName} (tried: ${variants.join(", ")})`);
    continue;
  }
  appendFileSync(githubEnv, `${targetName}=${parsed.get(foundKey)}\n`);
  console.log(`${targetName} <- ${foundKey}`);
}

if (missing.length > 0) {
  throw new Error(
    `Не нашли значение для: ${missing.join("; ")}. Смотри сырой вывод выше — ` +
      `реальные имена ключей в этой версии Supabase CLI отличаются от всех известных вариантов, ` +
      `нужно добавить ещё один в FIELD_KEY_VARIANTS этого скрипта.`,
  );
}
