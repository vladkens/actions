import { createHash, randomUUID } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

import { env, fail, files, input, main, mask, required, run, setOutput } from "../lib/core.ts"
import { bumpFormula, bumpFormulaArchives } from "./formula.ts"

await main(() => {
  const tag = input("tag")
  if (!tag) {
    console.log("no release in this run: nothing to bump")
    setOutput("changed", "false")
    return
  }
  required("file")
  const paths = files("file")
  if (paths.length > 1 && input("url"))
    fail("'url' is for one file; several use their release assets")
  const tap = required("tap")
  const formula = input("formula") || `${env("GITHUB_REPOSITORY").split("/")[1]}.rb`
  const archives = paths.map(file => ({
    url:
      input("url") ||
      `https://github.com/${env("GITHUB_REPOSITORY")}/releases/download/${tag}/${basename(file)}`,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
  }))

  // The token reaches git only through env (an http.extraheader for github.com), never the
  // command line that `run` logs.
  const token = required("token")
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64")
  mask(token)
  mask(basic)
  const auth = {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
    GIT_TERMINAL_PROMPT: "0",
  }
  // owner/repo on github.com, or any git URL (a local one in tests).
  const remote = /^[\w.-]+\/[\w.-]+$/.test(tap) ? `https://github.com/${tap}.git` : tap
  const dir = join(process.env.RUNNER_TEMP || tmpdir(), `homebrew-tap-${randomUUID()}`)
  run("git", ["clone", "--quiet", "--depth", "1", remote, dir], { env: auth })

  const path = join(dir, formula)
  if (!existsSync(path)) fail(`no ${formula} in ${tap}`)
  const before = readFileSync(path, "utf8")
  const version = tag.replace(/^v/, "")
  const after =
    archives.length > 1
      ? bumpFormulaArchives(before, version, archives)
      : bumpFormula(before, version, archives[0].url, archives[0].sha256)
  if (after === before) {
    console.log(`${formula} is already at ${tag}`)
    setOutput("changed", "false")
    return
  }
  writeFileSync(path, after)

  const name = basename(formula, ".rb")
  const bot = [
    "-c",
    "user.name=github-actions[bot]",
    "-c",
    "user.email=github-actions[bot]@users.noreply.github.com",
  ]
  run("git", ["-C", dir, "add", formula])
  run("git", ["-C", dir, ...bot, "commit", "--quiet", "-m", `${name} ${tag}`])
  run("git", ["-C", dir, "push", "--quiet"], { env: auth })
  for (const { url, sha256 } of archives.filter(x => after.includes(x.url)))
    console.log(`${tap}: ${formula} → ${tag} (${url}, sha256 ${sha256})`)
  setOutput("changed", "true")
})
