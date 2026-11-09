// Homebrew: a formula's or a cask's download set to a release, pushed to the tap.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

import { fail } from "./core.ts"
import { clone, commitAndPush, githubAuth, tempPath } from "./git.ts"

export type Archive = { url: string; sha256: string }

// A version goes into a double-quoted Ruby string, where `#{…}` or a quote would be code.
const checkVersion = (version: string): void => {
  if (!/^[0-9A-Za-z._+-]+$/.test(version))
    fail(`version '${version}' can't go into a formula or cask; expected only 0-9 A-Z a-z . _ + -`)
}

// The formula with its `url`, `sha256` and (when present) `version` set. One download only: a
// formula with several `url` lines (per-arch `on_arm` / `on_intel` blocks) is refused; those go
// through bumpFormulaArchives.
export const bumpFormula = (text: string, version: string, url: string, sha256: string): string => {
  checkVersion(version)
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
  checkVersion(version)
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

// A formula with one download takes the one archive; several, one download per platform.
export const bumpFormulaFiles = (text: string, version: string, archives: Archive[]): string => {
  if (!archives.length) fail("no release files for the formula; expected the archives it downloads")
  return archives.length > 1
    ? bumpFormulaArchives(text, version, archives)
    : bumpFormula(text, version, archives[0].url, archives[0].sha256)
}

// The cask with its `version` and `sha256` set for the release file its `url` downloads: a `url`
// with `#{version}` must be that file's release URL once the version is in, and stays as it is; a
// literal one moves to the file of the same name but for the version. One download only: a cask per arch (`arch`,
// `on_arm`, `sha256 arm:`) is refused.
export const bumpCask = (text: string, version: string, archives: Archive[]): string => {
  checkVersion(version)
  const line = (key: string) => {
    const re = new RegExp(`^(\\s*${key}\\s+)"([^"]*)"`, "gm")
    const found = [...text.matchAll(re)]
    if (found.length > 1)
      fail(`the cask has ${found.length} '${key}' lines; only single-download casks are supported`)
    if (!found.length) fail(`the cask has no '${key} "…"' line`)
    return { re, value: found[0][2] }
  }

  const url = line("url")
  const templated = url.value.includes("#{version}")
  const expanded = url.value.replaceAll("#{version}", version)
  if (expanded.includes("#{"))
    fail(`the cask's url ${url.value} interpolates more than #{version}; expected only #{version}`)
  const archive = templated
    ? archives.find(x => basename(x.url) === basename(expanded))
    : archives.find(x => archiveKey(x.url) === archiveKey(url.value))
  if (!archive) fail(`no file for the cask's url ${expanded}`)
  if (templated && expanded !== archive.url)
    fail(`the cask's url is ${expanded}; expected the release file's ${archive.url}`)

  const sha256 = line("sha256")
  const versionLine = line("version")
  text = text.replace(versionLine.re, `$1"${version}"`).replace(sha256.re, `$1"${archive.sha256}"`)
  return templated ? text : text.replace(url.re, `$1"${archive.url}"`)
}

export type TapBump = {
  tap: string // owner/repo on github.com, or any git URL (a local one in tests)
  token: string
  tag: string
  paths: string[] // the file's candidate paths in the tap, the first that exists is bumped
  edit: (text: string) => string
}

// Clones the tap, edits the file and pushes it as `<name> <tag>`; true when it changed.
export const bumpTap = ({ tap, token, tag, paths, edit }: TapBump): boolean => {
  const auth = githubAuth(token)
  const remote = /^[\w.-]+\/[\w.-]+$/.test(tap) ? `https://github.com/${tap}.git` : tap
  const dir = tempPath("homebrew-tap")
  clone(remote, dir, auth)

  const path = paths.find(x => existsSync(join(dir, x)))
  if (!path) fail(`no ${paths.join(" or ")} in ${tap}`)
  const before = readFileSync(join(dir, path), "utf8")
  const after = edit(before)
  if (after === before) {
    console.log(`${path} is already at ${tag}`)
    return false
  }

  writeFileSync(join(dir, path), after)
  commitAndPush(dir, [path], `${basename(path, ".rb")} ${tag}`, auth)
  console.log(`${tap}: ${path} → ${tag}`)
  return true
}
