import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { RELEASE_NOT_FOUND, TAG_NOT_FOUND } from "../lib/github.ts"
import { manifestVersion, tomlString } from "../lib/manifest.ts"
import { changelogNotes, hasEntry, isReleaser } from "../release-check/notes.ts"
import { completedProblems, isFinished, planProblems } from "../release-check/plans.ts"

const changelog = `## v1.0.10 – 2026-10-12

### Fixes

- Fixed ten

**Full Changelog**: https://github.com/vladkens/fixture/compare/v1.0.1...v1.0.10

---

## v1.0.1 – 2026-10-01

### Features

- Added one (#12)

---

## v1.0.0 – 2026-09-01

- Added zero

---

## v0.9.0 – 2026-08-01

Initial release.
`

test("manifest versions", () => {
  const cargo =
    '[package]\nname = "x"\nversion = "1.0.1"\n\n[dependencies]\nother = { version = "2.0.0" }\n\n[[bin]]\nname = "x"\nversion = "9.9.9"\n'
  assert.equal(manifestVersion("Cargo.toml", cargo), "1.0.1")
  const workspace =
    '[workspace]\nmembers = ["crates/*"]\n\n[workspace.package]\nversion = "1.0.0"\n\n[package]\nname = "x"\nversion.workspace = true\n'
  assert.equal(manifestVersion("Cargo.toml", workspace), "1.0.0")
  assert.equal(
    manifestVersion(
      "py/pyproject.toml",
      '[project]\nname = "x"\nversion = "1.0.10"\ndependencies = ["httpx>=0.27"]\n',
    ),
    "1.0.10",
  )
  assert.equal(
    manifestVersion("package.json", '{ "version": "0.9.0", "dependencies": { "other": "2.0.0" } }'),
    "0.9.0",
  )
  assert.throws(
    () => manifestVersion("pyproject.toml", '[project]\ndynamic = ["version"]'),
    /no static version/,
  )
  assert.throws(() => manifestVersion("setup.py", ""), /unknown manifest/)
})

test("toml strings come only from their table", () => {
  const text =
    '[dependencies]\nversion = "0.1"\n[package]\nname = "x" # c\n[package.metadata]\nversion = "2"'
  assert.equal(tomlString(text, "package", "name"), "x")
  assert.equal(tomlString(text, "package", "version"), undefined)
  assert.equal(tomlString(text, "package.metadata", "version"), "2")
})

test("notes match the exact tag, without rules", () => {
  assert.equal(changelogNotes(changelog, "v1.0.1"), "### Features\n\n- Added one (#12)")
  assert.match(
    changelogNotes(changelog, "v1.0.10"),
    /^### Fixes\n\n- Fixed ten\n\n\*\*Full Changelog\*\*: \S+$/,
  )
  assert.equal(changelogNotes(changelog, "v1.0.0"), "- Added zero")
  assert.equal(changelogNotes(changelog, "v1.0"), "")
  assert.equal(changelogNotes(changelog, "v1.0.2"), "")
  assert.equal(changelogNotes(changelog.replace(/\n/g, "\r\n"), "v1.0.0"), "- Added zero")
})

test("notes need a bullet", () => {
  assert.equal(hasEntry(changelogNotes(changelog, "v1.0.1")), true)
  assert.equal(hasEntry(changelogNotes(changelog, "v0.9.0")), false)
  assert.equal(hasEntry("-"), false)
  assert.equal(hasEntry("-  "), false)
})

test("releasers", () => {
  assert.equal(isReleaser("vladkens", "vladkens"), true)
  assert.equal(isReleaser("VladKens", "other, vladkens"), true)
  assert.equal(isReleaser("vladkens", "a\nvladkens b"), true)
  assert.equal(isReleaser("flaburgan", "vladkens"), false)
  assert.equal(isReleaser("vlad", "vladkens"), false)
  assert.equal(isReleaser("anyone", ""), true)
  assert.equal(isReleaser("anyone", " , "), true)
})

test("a plan is finished when every box is ticked", () => {
  assert.equal(isFinished("- [x] a\n- [X] b"), true)
  assert.equal(isFinished("1. [x] a\n  * [x] b"), true)
  assert.equal(isFinished("- [x] a\n- [ ] b"), false)
  assert.equal(isFinished("1. [x] a\n2. [ ] b"), false)
  assert.equal(isFinished("# notes\n\nno tasks"), false)
  assert.equal(isFinished("- [x] a\n```\n- [ ] quoted\n```"), true)
  assert.equal(isFinished("```\n- [x] quoted\n```"), false)
  assert.equal(isFinished("- [x]a"), false)
  // A fence closes on its own character, at least as long: ``` inside ```` or ~~~ stays quoted.
  assert.equal(isFinished("- [x] a\n````md\n```\n- [ ] quoted\n```\n````"), true)
  assert.equal(isFinished("- [x] a\n~~~\n```\n- [ ] quoted\n~~~"), true)
  assert.equal(isFinished("- [x] a\n```\n~~~\n- [ ] quoted\n```"), true)
  assert.equal(isFinished("- [x] a\n````\n- [x] quoted\n````\n- [ ] b"), false)
  // A backtick fence's info string has no backtick, and a closing fence has nothing after it.
  assert.equal(isFinished("- [x] a\n```a`b\n- [ ] b"), false)
  assert.equal(isFinished("- [x] a\n```\n``` x\n- [ ] q\n```"), true)
})

test("a completed plan has Done at the top and a result", () => {
  assert.deepEqual(
    completedProblems("# T\n\nDone: 2026-10-13, PR #1\n\nText\n\n## Result\n\nOk"),
    [],
  )
  assert.deepEqual(completedProblems("Done: 2026-10-22\n\n# T\n\n## Result"), [])
  assert.deepEqual(completedProblems("# T\r\n\r\nDone: 2026-10-13\r\n\r\n## Result\r\n"), [])
  assert.deepEqual(completedProblems("# T\n\nText\n\nDone: 2026-10-13\n\n## Result"), [
    "no 'Done: yyyy-mm-dd' below the title",
  ])
  assert.deepEqual(completedProblems("# T\n\nDone: 13.10.2026\n\n## Result"), [
    "no 'Done: yyyy-mm-dd' below the title",
  ])
  assert.deepEqual(completedProblems("# T\n\nDone: 2026-13-01\n\n## Result"), [
    "no 'Done: yyyy-mm-dd' below the title",
  ])
  assert.deepEqual(completedProblems("# T\n\nDone: 2026-10-32\n\n## Result"), [
    "no 'Done: yyyy-mm-dd' below the title",
  ])
  assert.deepEqual(completedProblems("# T\n\nDone: 2026-10-311\n\n## Result"), [
    "no 'Done: yyyy-mm-dd' below the title",
  ])
  assert.deepEqual(completedProblems("# T\n\nDone: 2026-10-13\n\n## Results"), ["no '## Result'"])
  assert.deepEqual(completedProblems("# T\n\nDone: 2026-10-13\n\n```\n## Result\n```"), [
    "no '## Result'",
  ])
  assert.deepEqual(completedProblems(""), [
    "no 'Done: yyyy-mm-dd' below the title",
    "no '## Result'",
  ])
})

// The plan files' own rules are above; this is which files are checked and how they are reported.
test("plans directories", t => {
  const dir = mkdtempSync(join(tmpdir(), "plans-"))
  t.after(() => rmSync(dir, { recursive: true }))
  const completed = join(dir, "completed")
  mkdirSync(completed)
  writeFileSync(join(dir, "20260101-finished.md"), "# Finished\n\n- [x] First\n")
  writeFileSync(join(dir, "20260102-open.md"), "# Open\n\n- [x] First\n- [ ] Second\n")
  writeFileSync(join(dir, "notes.txt"), "- [x] Not a plan\n")
  writeFileSync(join(completed, "20260101-no-done.md"), "# Late\n\nText\n\nDone: 2026-01-02\n")
  writeFileSync(join(completed, "20260102-ok.md"), "# Fine\n\nDone: 2026-01-03\n\n## Result\n")

  assert.deepEqual(planProblems(dir), [
    `${join(dir, "20260101-finished.md")}: every box ticked, not moved to ${completed}/`,
    `${join(completed, "20260101-no-done.md")}: no 'Done: yyyy-mm-dd' below the title, no '## Result'`,
  ])
  assert.deepEqual(planProblems(join(dir, "missing")), [])
})

test("only gh not-found errors read as missing", () => {
  assert.match("gh: Not Found (HTTP 404)", TAG_NOT_FOUND)
  assert.doesNotMatch(
    'gh: Bad credentials (HTTP 401)\n{"message": "Bad credentials", "status": "401"}',
    TAG_NOT_FOUND,
  )
  assert.match("release not found", RELEASE_NOT_FOUND)
  assert.doesNotMatch(
    "HTTP 401: Bad credentials (https://api.github.com/repos/o/r/releases/tags/v1)\nTry authenticating with:  gh auth login -h github.com",
    RELEASE_NOT_FOUND,
  )
})
