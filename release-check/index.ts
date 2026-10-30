import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { commitTitle } from "../lib/commit.ts"
import { env, fail, input, logText, main, setOutput } from "../lib/core.ts"
import { tagCommit } from "../lib/github.ts"
import { MANIFESTS, manifestVersion } from "../lib/manifest.ts"
import { changelogNotes, hasEntry, isReleaser } from "./notes.ts"
import { planProblems } from "./plans.ts"

await main(() => {
  // A release PR is checked before its merge; who merges it and where its tag goes are the merged
  // commit's checks.
  const pr = env("GITHUB_EVENT_NAME") === "pull_request"

  const actor = input("actor")
  const releasers = input("releasers")
  if (!pr && !isReleaser(actor, releasers)) {
    fail(
      `release run started by '${actor}', but only '${releasers}' may release: nothing published; one of them can re-run it`,
    )
  }

  const manifest = input("manifest") || MANIFESTS.find(x => existsSync(x))
  if (!manifest) fail(`no ${MANIFESTS.join(", ")} here; set 'manifest'`)
  const version = manifestVersion(manifest, readFileSync(manifest, "utf8"))
  const tag = `v${version}`

  const title = commitTitle(input("message"))
  if (title !== `release: ${tag}`) {
    fail(
      `expected the ${pr ? "PR" : "commit"} title 'release: ${tag}' (from ${manifest}), got '${title}'`,
    )
  }

  const changelog = input("changelog")
  if (!existsSync(changelog)) fail(`no ${changelog}`)
  const notes = changelogNotes(readFileSync(changelog, "utf8"), tag)
  if (!hasEntry(notes)) fail(`${changelog} has no '## ${tag}' section with a '- ' entry`)

  const plans = input("plans")
  const problems = plans ? planProblems(plans) : []
  if (problems.length) {
    fail(
      `expected each finished plan in ${join(plans, "completed")}/ with 'Done: yyyy-mm-dd' below its title and a '## Result', got ${problems.join("; ")}`,
    )
  }

  // Before anything is published: a tag left on another commit would fail the release after it.
  // Before the merge any such tag means this version is out already.
  const at = tagCommit(tag)
  if (pr && at)
    fail(`tag ${tag} already exists (on ${at}): ${tag} is already released, bump the version`)

  if (!pr && at && at !== env("GITHUB_SHA"))
    fail(`tag ${tag} already points to ${at}, not ${env("GITHUB_SHA")}`)

  const notesFile = join(process.env.RUNNER_TEMP || tmpdir(), `notes-${tag}.md`)
  writeFileSync(notesFile, `${notes}\n`)

  setOutput("tag", tag)
  setOutput("version", version)
  setOutput("notes", notes)
  setOutput("notes-file", notesFile)
  console.log(
    `release ${tag}${pr ? " (a release PR, before its merge)" : ""}, notes from ${changelog}:\n`,
  )
  logText(notes)
})
