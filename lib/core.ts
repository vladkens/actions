// The few pieces of @actions/core the actions need, so they run without dependencies:
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { appendFileSync, globSync, statSync } from "node:fs"

class Failure extends Error {}

// An explicit type: TypeScript narrows after a call to a `never` function only then.
export const fail: (message: string) => never = message => {
  throw new Failure(message)
}

// Runs an action body; any error becomes one `::error::` line and a failed step.
export const main = async (body: () => void | Promise<void>): Promise<void> => {
  try {
    await body()
  } catch (err) {
    const message =
      err instanceof Failure ? err.message : String(err instanceof Error ? err.stack : err)
    console.log(`::error::${escape(message)}`)
    process.exitCode = 1
  }
}

export const input = (name: string): string => {
  return (process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? "").trim()
}

export const required = (name: string): string => {
  return input(name) || fail(`input '${name}' is required`)
}

export const bool = (name: string): boolean => {
  const value = input(name)
  if (value === "true" || value === "false") return value === "true"
  return fail(`input '${name}' must be 'true' or 'false', got '${value}'`)
}

// One glob per line; each must match at least one file. Sorted, without duplicates.
export const files = (name: string): string[] => {
  const found = new Set<string>()
  for (const pattern of input(name)
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean)) {
    const matched = globSync(pattern).filter(x => statSync(x).isFile())
    if (!matched.length) fail(`input '${name}': '${pattern}' matches no files`)
    for (const file of matched) found.add(file)
  }
  return [...found].sort()
}

export const env = (name: string): string => {
  return process.env[name] || fail(`${name} is not set: run this inside GitHub Actions`)
}

export const setOutput = (name: string, value: string): void => {
  const delimiter = `EOF_${randomUUID()}`
  appendFileSync(env("GITHUB_OUTPUT"), `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
}

export const mask = (secret: string): void => {
  console.log(`::add-mask::${escape(secret)}`)
}

export const notice = (message: string): void => {
  console.log(`::notice::${escape(message)}`)
}

// Prints untrusted text with workflow commands off, so a `::` line in it is not run.
export const logText = (text: string): void => {
  const resume = randomUUID()
  console.log(`::stop-commands::${resume}`)
  console.log(text)
  console.log(`::${resume}::`)
}

const escape = (data: string): string => {
  return data.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}

type RunOptions = { env?: Record<string, string>; stream?: boolean }

// Runs a command without a shell, so arguments are never interpreted. Returns trimmed stdout;
// with `stream` the output goes to the log instead. Throws when the command fails.
export const run = (cmd: string, args: string[], opts: RunOptions = {}): string => {
  const line = [cmd, ...args].join(" ")
  console.log(`$ ${line}`)
  try {
    const out = execFileSync(cmd, args, {
      encoding: "utf8",
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", opts.stream ? "inherit" : "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    })
    return (out ?? "").trim()
  } catch (err) {
    const status = (err as { status?: number | null }).status
    return fail(
      `'${line}' failed${status == null ? "" : ` with exit code ${status}`}; its output is above`,
    )
  }
}

// Like `run` but quiet, and null instead of an error: for checks like "does this exist".
export const probe = (cmd: string, args: string[], opts: RunOptions = {}): string | null => {
  try {
    const out = execFileSync(cmd, args, {
      encoding: "utf8",
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    })
    return out.trim()
  } catch {
    return null
  }
}
