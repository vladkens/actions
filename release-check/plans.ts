// Plans in `docs/plans/`: a finished one moves to `completed/` with a `Done:` date and a result.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The lines outside fenced code blocks, where a plan may quote examples. A fence closes only on
// its own character, repeated at least as often, with nothing after it.
function prose(text: string): string[] {
  const out: string[] = []
  let fence = ''
  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (!fence && marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      fence = marker[1]
      continue
    }

    if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
      fence = ''
      continue
    }

    if (!fence) out.push(line)
  }

  return out
}

// At least one ticked box and none left open, in `- [x]` items (also `*`, `+` and `1.` ones).
export function isFinished(text: string): boolean {
  let done = 0
  let open = 0
  for (const line of prose(text)) {
    const box = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\](?:\s|$)/)
    if (box?.[1] === ' ') open++
    else if (box) done++
  }

  return done > 0 && open === 0
}

// What a completed plan lacks: `Done: yyyy-mm-dd` (and anything after it, like `, PR #3`) as the
// first line below the `# ` title, or as the very first line, and a `## Result` section.
export function completedProblems(text: string): string[] {
  const lines = prose(text)
  const filled = lines.map((x) => x.trim()).filter(Boolean)
  const top = filled[0]?.startsWith('# ') ? filled[1] : filled[0]

  const problems: string[] = []
  if (!/^Done: \d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.test(top ?? ''))
    problems.push("no 'Done: yyyy-mm-dd' below the title")
  if (!lines.some((x) => /^## Result\s*$/.test(x))) problems.push("no '## Result'")
  return problems
}

// Each plan file in `dir` that breaks the rules, as `<path>: <problems>`; none for a missing dir.
export function planProblems(dir: string): string[] {
  const out: string[] = []
  const completed = join(dir, 'completed')
  for (const path of markdown(dir)) {
    if (isFinished(readFileSync(path, 'utf8'))) out.push(`${path}: every box ticked, not moved to ${completed}/`)
  }

  for (const path of markdown(completed)) {
    const problems = completedProblems(readFileSync(path, 'utf8'))
    if (problems.length) out.push(`${path}: ${problems.join(', ')}`)
  }

  return out
}

function markdown(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((x) => x.isFile() && x.name.endsWith('.md'))
    .map((x) => join(dir, x.name))
    .sort()
}
