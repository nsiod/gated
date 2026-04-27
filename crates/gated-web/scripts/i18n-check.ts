#!/usr/bin/env bun
// i18n parity check.
//
// Diff the flattened dot-path keys of every namespace across all locales
// under `public/locales/*`. Fails (exit 1) if any key is present in one
// locale but missing in another. Intended for `just lint` / CI.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const LOCALES_DIR = resolve(import.meta.dir, "..", "public", "locales");

if (!existsSync(LOCALES_DIR)) {
  console.error(`i18n-check: locales dir not found: ${LOCALES_DIR}`);
  process.exit(2);
}

type KeySet = Set<string>;
type Namespace = { locale: string; file: string; keys: KeySet };

function flatten(obj: unknown, prefix: string, out: KeySet): void {
  if (obj === null || typeof obj !== "object") {
    out.add(prefix);
    return;
  }
  if (Array.isArray(obj)) {
    out.add(prefix);
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix === "" ? k : `${prefix}.${k}`;
    flatten(v, next, out);
  }
}

function loadNamespace(locale: string, file: string): Namespace {
  const path = join(LOCALES_DIR, locale, file);
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  const keys: KeySet = new Set();
  flatten(parsed, "", keys);
  return { locale, file, keys };
}

function main(): number {
  const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (locales.length < 2) {
    console.log(`i18n-check: only ${locales.length} locale(s) found — nothing to diff`);
    return 0;
  }

  // Collect the union of filenames across all locales; we diff on the
  // intersection but also flag any namespace that is present in one locale
  // only.
  const filesByLocale = new Map<string, Set<string>>();
  for (const loc of locales) {
    const names = readdirSync(join(LOCALES_DIR, loc))
      .filter((n) => n.endsWith(".json"));
    filesByLocale.set(loc, new Set(names));
  }
  const allFiles = new Set<string>();
  for (const s of filesByLocale.values()) {
    for (const f of s) allFiles.add(f);
  }

  let problems = 0;

  for (const file of Array.from(allFiles).sort()) {
    const missingLocales = locales.filter((l) => !filesByLocale.get(l)!.has(file));
    if (missingLocales.length > 0) {
      console.error(
        `i18n-check: namespace "${file}" missing from locale(s): ${missingLocales.join(", ")}`,
      );
      problems++;
      continue;
    }

    const namespaces = locales.map((l) => loadNamespace(l, file));
    const [first, ...rest] = namespaces;

    // Report keys present in `first` but missing from each `other`, and vice
    // versa. Accumulate both directions so a single run surfaces everything.
    for (const other of rest) {
      const onlyInFirst = [...first.keys].filter((k) => !other.keys.has(k)).sort();
      const onlyInOther = [...other.keys].filter((k) => !first.keys.has(k)).sort();
      if (onlyInFirst.length > 0) {
        console.error(
          `i18n-check [${file}]: ${onlyInFirst.length} key(s) in ${first.locale} missing from ${other.locale}:`,
        );
        for (const k of onlyInFirst) console.error(`  - ${k}`);
        problems++;
      }
      if (onlyInOther.length > 0) {
        console.error(
          `i18n-check [${file}]: ${onlyInOther.length} key(s) in ${other.locale} missing from ${first.locale}:`,
        );
        for (const k of onlyInOther) console.error(`  - ${k}`);
        problems++;
      }
    }
  }

  if (problems === 0) {
    console.log(
      `i18n-check: OK — ${locales.length} locales (${locales.join(", ")}), ${allFiles.size} namespaces in parity`,
    );
    return 0;
  }
  console.error(`i18n-check: ${problems} mismatch(es)`);
  return 1;
}

process.exit(main());
