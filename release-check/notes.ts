// The body of the `## <tag> ...` section, up to the next `## ` heading, without `---` rules. The
// tag is compared as a word, not a pattern: `v1.0.1` doesn't match `## v1.0.10`.
export const changelogNotes = (text: string, tag: string): string => {
  const out: string[] = []
  let found = false
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      found = line.slice(3).trim().split(/\s+/)[0] === tag
      continue
    }
    if (found && line.trim() !== "---") out.push(line)
  }
  return out.join("\n").trim()
}

export const hasEntry = (notes: string): boolean => {
  return /^- \S/m.test(notes)
}

// Logins separated by spaces, commas or lines; GitHub compares them case-insensitively.
export const isReleaser = (actor: string, releasers: string): boolean => {
  const list = releasers
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(x => x.toLowerCase())
  return list.length === 0 || list.includes(actor.toLowerCase())
}
