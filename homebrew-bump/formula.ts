import { basename } from "node:path"

import { fail } from "../lib/core.ts"

export type Archive = { url: string; sha256: string }

// The formula with its `url`, `sha256` and (when present) `version` set. One download only: a
// formula with several `url` lines (per-arch `on_arm` / `on_intel` blocks) is refused; those go
// through bumpFormulaArchives.
export const bumpFormula = (text: string, version: string, url: string, sha256: string): string => {
  const set = (key: string, value: string, required: boolean) => {
    const re = new RegExp(`^(\\s*${key}\\s+)"[^"]*"`, "gm")
    const found = text.match(re)?.length ?? 0
    if (found > 1)
      fail(`the formula has ${found} '${key}' lines; only single-download formulas are supported`)
    if (!found && required) fail(`the formula has no '${key} "…"' line`)
    text = text.replace(re, `$1"${value}"`)
  }
  set("url", url, true)
  set("sha256", sha256, true)
  set("version", version, false)
  return text
}

// An archive's name without its version, the same in every release.
const archiveKey = (url: string): string => {
  return basename(url).replace(/\d+\.\d+\.\d+/, "")
}

// The formula with each `url`, the `sha256` right after it and (when present) `version` set from
// the archive of the same name, for one download per platform. Archives it doesn't download are
// skipped; a `url` without an archive is refused, so no platform stays behind.
export const bumpFormulaArchives = (text: string, version: string, archives: Archive[]): string => {
  const urls = text.match(/^\s*url\s+"/gm)?.length ?? 0
  const pairs = /^(\s*url\s+)"([^"]*)"((?:\n\s*version\s+"[^"]*")?\n\s*sha256\s+)"[^"]*"/gm
  if (!urls) fail(`the formula has no 'url "…"' line`)
  if (text.match(pairs)?.length !== urls) fail("every 'url' needs a 'sha256' right after it")
  return text
    .replace(pairs, (_, url: string, old: string, sha256: string) => {
      const archive = archives.find(x => archiveKey(x.url) === archiveKey(old))
      if (!archive) fail(`no file for the formula's url ${old}`)
      return `${url}"${archive.url}"${sha256}"${archive.sha256}"`
    })
    .replace(/^(\s*version\s+)"[^"]*"/gm, `$1"${version}"`)
}
