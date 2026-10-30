// A package's version from Cargo.toml, pyproject.toml or package.json.
import { basename } from "node:path"

import { fail } from "./core.ts"

export const MANIFESTS = ["Cargo.toml", "pyproject.toml", "package.json"]

export const manifestVersion = (path: string, text: string): string => {
  const name = basename(path)
  let version: string | undefined
  if (name === "Cargo.toml") {
    // A workspace member may take its version from `[workspace.package]` of the same file.
    version =
      tomlString(text, "package", "version") ?? tomlString(text, "workspace.package", "version")
  } else if (name === "pyproject.toml") {
    version = tomlString(text, "project", "version") ?? tomlString(text, "tool.poetry", "version")
  } else if (name === "package.json") {
    const json: unknown = JSON.parse(text)
    const value =
      json && typeof json === "object" ? (json as { version?: unknown }).version : undefined
    version = typeof value === "string" ? value : undefined
  } else {
    fail(`unknown manifest '${path}', expected one of ${MANIFESTS.join(", ")}`)
  }
  return version || fail(`no static version in ${path}`)
}

// A `key = "value"` string in a top-level `[table]`. Enough for manifests' version fields, not a
// TOML parser: inline tables and multi-line strings are not read.
export const tomlString = (text: string, table: string, key: string): string | undefined => {
  let current = ""
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const header = line.match(/^\[\s*([^[\]]+?)\s*\]/)
    if (header) {
      current = header[1]
      continue
    }
    if (line.startsWith("[[")) current = ""
    if (current !== table) continue
    const pair = line.match(/^([\w.-]+)\s*=\s*"([^"]*)"/)
    if (pair && pair[1] === key) return pair[2]
  }
  return undefined
}
