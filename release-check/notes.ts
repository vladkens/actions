// The first line of a commit message, without the ` (#N)` a squash merge appends.
export function commitTitle(message: string): string {
  return message.split(/\r?\n/)[0].trim().replace(/ \(#\d+\)$/, '')
}

// The body of the `## <tag> ...` section, up to the next `## ` heading, without `---` rules. The
// tag is compared as a word, not a pattern: `v1.0.1` doesn't match `## v1.0.10`.
export function changelogNotes(text: string, tag: string): string {
  const out: string[] = []
  let found = false
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      found = line.slice(3).trim().split(/\s+/)[0] === tag
      continue
    }
    if (found && line.trim() !== '---') out.push(line)
  }
  return out.join('\n').trim()
}

export function hasEntry(notes: string): boolean {
  return /^- \S/m.test(notes)
}
