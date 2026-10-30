import { fail } from "../lib/core.ts"

// The formula with its `url`, `sha256` and (when present) `version` set. One download only: a
// formula with several `url` lines (per-arch `on_arm` / `on_intel` blocks) is refused.
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
