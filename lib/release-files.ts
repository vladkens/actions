// A release's files as package managers see them: a name, the release asset's URL and a sha256.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { basename, join } from "node:path"

import { env, fail, files, input } from "./core.ts"
import { tempPath } from "./git.ts"
import { findRelease, gh } from "./github.ts"

// `sha256` is computed on first use, so a file nobody needs is never downloaded.
export type ReleaseFile = { name: string; url: string; readonly sha256: string }

export const sha256File = (path: string): string => {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

export const releaseUrl = (tag: string, name: string): string => {
  return `https://github.com/${env("GITHUB_REPOSITORY")}/releases/download/${tag}/${name}`
}

const lazyFile = (tag: string, name: string, path: () => string): ReleaseFile => {
  let hash: string | undefined
  return {
    name,
    url: releaseUrl(tag, name),
    get sha256() {
      hash ??= sha256File(path())
      return hash
    },
  }
}

// The local files of input `name` (globs, one per line); when it is empty, the assets of the
// tag's release, each downloaded with gh (input `token`) the first time its sha256 is needed.
export const releaseFiles = (tag: string, name: string): ReleaseFile[] => {
  if (input(name)) return files(name).map(path => lazyFile(tag, basename(path), () => path))

  const release = findRelease(tag)
  if (!release) fail(`no release ${tag} to take the files from; pass '${name}'`)
  const dir = tempPath("release-files")
  return release.assets.map(asset =>
    lazyFile(tag, asset, () => {
      gh(["release", "download", tag, "--pattern", asset, "--dir", dir, "--clobber"])
      return join(dir, asset)
    }),
  )
}
