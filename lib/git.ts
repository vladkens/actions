// A repo the action clones, edits and pushes as github-actions[bot]: a Homebrew tap, an AUR package.
import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { mask, run } from "./core.ts"

// A fresh path under the runner's temp dir, removed with the runner.
export const tempPath = (prefix: string): string => {
  return join(process.env.RUNNER_TEMP || tmpdir(), `${prefix}-${randomUUID()}`)
}

// git's env for a token that pushes to github.com: an http.extraheader through env, never the
// command line that `run` logs.
export const githubAuth = (token: string): Record<string, string> => {
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64")
  mask(token)
  mask(basic)
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
    GIT_TERMINAL_PROMPT: "0",
  }
}

export const clone = (remote: string, dir: string, env: Record<string, string>): void => {
  run("git", ["clone", "--quiet", "--depth", "1", remote, dir], { env })
}

// Commits the paths as github-actions[bot], with the diff in the log, and pushes the branch.
export const commitAndPush = (
  dir: string,
  paths: string[],
  message: string,
  env: Record<string, string>,
): void => {
  const bot = [
    "-c",
    "user.name=github-actions[bot]",
    "-c",
    "user.email=github-actions[bot]@users.noreply.github.com",
  ]
  run("git", ["-C", dir, "add", "--", ...paths])
  run("git", ["-C", dir, "--no-pager", "diff", "--cached"], { stream: true })
  run("git", ["-C", dir, ...bot, "commit", "--quiet", "-m", message])
  run("git", ["-C", dir, "push", "--quiet"], { env })
}
