// The version a non-release build reports: `git describe` against the last `vX.Y.Z` tag, e.g.
// `0.9.0-12-g3672a1b` (12 commits after v0.9.0); without such a tag, the manifest's own version
// with the commit, e.g. `0.1.0-g3672a1b`.
export function devVersion(described: string | null, version: string, sha: string): string {
  return described ? described.replace(/^v/, '') : `${version}-g${sha}`
}

// Cargo.toml with `[package] version = "..."` set; undefined when the package has no literal version
// there (e.g. `version.workspace = true`).
export function setManifestVersion(text: string, version: string): string | undefined {
  const lines = text.split('\n')
  let table = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const header = line.match(/^\[\s*([^[\]]+?)\s*\]/)
    if (header) {
      table = header[1]
      continue
    }
    if (line.startsWith('[[')) table = ''
    if (table === 'package' && /^version\s*=\s*"/.test(line)) {
      lines[i] = lines[i].replace(/^(\s*version\s*=\s*")[^"]*"/, `$1${version}"`)
      return lines.join('\n')
    }
  }
  return undefined
}

// Cargo.lock with the local package `name` (no `source`, as registry and git packages have) moved
// from `from` to `version`; undefined when there is no such entry.
export function setLockVersion(text: string, name: string, from: string, version: string): string | undefined {
  const blocks = text.split(/\n(?=\[\[package\]\]\n)/)
  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n')
    if (lines[0] !== '[[package]]' || lines.some((x) => x.startsWith('source = '))) continue
    if (!lines.includes(`name = "${name}"`) || !lines.includes(`version = "${from}"`)) continue
    blocks[i] = lines.map((x) => (x === `version = "${from}"` ? `version = "${version}"` : x)).join('\n')
    return blocks.join('\n')
  }
  return undefined
}
