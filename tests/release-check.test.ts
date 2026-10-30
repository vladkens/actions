import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { RELEASE_NOT_FOUND, TAG_NOT_FOUND } from '../lib/github.ts'
import { manifestVersion, tomlString } from '../lib/manifest.ts'
import { changelogNotes, hasEntry, isReleaser } from '../release-check/notes.ts'
import { completedProblems, isFinished, planProblems } from '../release-check/plans.ts'

const fixture = (path: string) => readFileSync(new URL(`fixtures/${path}`, import.meta.url), 'utf8')
const version = (path: string) => manifestVersion(path, fixture(path))

test('manifest versions', () => {
  assert.equal(version('cargo/Cargo.toml'), '1.0.1')
  assert.equal(version('workspace/Cargo.toml'), '1.0.0')
  assert.equal(version('pyproject/pyproject.toml'), '1.0.10')
  assert.equal(version('npm/package.json'), '0.9.0')
  assert.throws(() => manifestVersion('pyproject.toml', '[project]\ndynamic = ["version"]'), /no static version/)
  assert.throws(() => manifestVersion('setup.py', ''), /unknown manifest/)
})

test('toml strings come only from their table', () => {
  const text = '[dependencies]\nversion = "0.1"\n[package]\nname = "x" # c\n[package.metadata]\nversion = "2"'
  assert.equal(tomlString(text, 'package', 'name'), 'x')
  assert.equal(tomlString(text, 'package', 'version'), undefined)
  assert.equal(tomlString(text, 'package.metadata', 'version'), '2')
})

test('notes match the exact tag, without rules', () => {
  const log = fixture('changelog.md')
  assert.equal(changelogNotes(log, 'v1.0.1'), '### Features\n\n- Added one (#12)')
  assert.match(changelogNotes(log, 'v1.0.10'), /^### Fixes\n\n- Fixed ten\n\n\*\*Full Changelog\*\*: \S+$/)
  assert.equal(changelogNotes(log, 'v1.0.0'), '- Added zero')
  assert.equal(changelogNotes(log, 'v1.0'), '')
  assert.equal(changelogNotes(log, 'v1.0.2'), '')
  assert.equal(changelogNotes(log.replace(/\n/g, '\r\n'), 'v1.0.0'), '- Added zero')
})

test('notes need a bullet', () => {
  const log = fixture('changelog.md')
  assert.equal(hasEntry(changelogNotes(log, 'v1.0.1')), true)
  assert.equal(hasEntry(changelogNotes(log, 'v0.9.0')), false)
  assert.equal(hasEntry('-'), false)
  assert.equal(hasEntry('-  '), false)
})

test('releasers', () => {
  assert.equal(isReleaser('vladkens', 'vladkens'), true)
  assert.equal(isReleaser('VladKens', 'other, vladkens'), true)
  assert.equal(isReleaser('vladkens', 'a\nvladkens b'), true)
  assert.equal(isReleaser('flaburgan', 'vladkens'), false)
  assert.equal(isReleaser('vlad', 'vladkens'), false)
  assert.equal(isReleaser('anyone', ''), true)
  assert.equal(isReleaser('anyone', ' , '), true)
})

test('a plan is finished when every box is ticked', () => {
  assert.equal(isFinished('- [x] a\n- [X] b'), true)
  assert.equal(isFinished('1. [x] a\n  * [x] b'), true)
  assert.equal(isFinished('- [x] a\n- [ ] b'), false)
  assert.equal(isFinished('1. [x] a\n2. [ ] b'), false)
  assert.equal(isFinished('# notes\n\nno tasks'), false)
  assert.equal(isFinished('- [x] a\n```\n- [ ] quoted\n```'), true)
  assert.equal(isFinished('```\n- [x] quoted\n```'), false)
  assert.equal(isFinished('- [x]a'), false)
  // A fence closes on its own character, at least as long: ``` inside ```` or ~~~ stays quoted.
  assert.equal(isFinished('- [x] a\n````md\n```\n- [ ] quoted\n```\n````'), true)
  assert.equal(isFinished('- [x] a\n~~~\n```\n- [ ] quoted\n~~~'), true)
  assert.equal(isFinished('- [x] a\n```\n~~~\n- [ ] quoted\n```'), true)
  assert.equal(isFinished('- [x] a\n````\n- [x] quoted\n````\n- [ ] b'), false)
  // A backtick fence's info string has no backtick, and a closing fence has nothing after it.
  assert.equal(isFinished('- [x] a\n```a`b\n- [ ] b'), false)
  assert.equal(isFinished('- [x] a\n```\n``` x\n- [ ] q\n```'), true)
})

test('a completed plan has Done at the top and a result', () => {
  assert.deepEqual(completedProblems('# T\n\nDone: 2026-10-13, PR #1\n\nText\n\n## Result\n\nOk'), [])
  assert.deepEqual(completedProblems('Done: 2026-10-22\n\n# T\n\n## Result'), [])
  assert.deepEqual(completedProblems('# T\r\n\r\nDone: 2026-10-13\r\n\r\n## Result\r\n'), [])
  assert.deepEqual(completedProblems('# T\n\nText\n\nDone: 2026-10-13\n\n## Result'), ["no 'Done: yyyy-mm-dd' below the title"])
  assert.deepEqual(completedProblems('# T\n\nDone: 13.10.2026\n\n## Result'), ["no 'Done: yyyy-mm-dd' below the title"])
  assert.deepEqual(completedProblems('# T\n\nDone: 2026-13-01\n\n## Result'), ["no 'Done: yyyy-mm-dd' below the title"])
  assert.deepEqual(completedProblems('# T\n\nDone: 2026-10-32\n\n## Result'), ["no 'Done: yyyy-mm-dd' below the title"])
  assert.deepEqual(completedProblems('# T\n\nDone: 2026-10-311\n\n## Result'), ["no 'Done: yyyy-mm-dd' below the title"])
  assert.deepEqual(completedProblems('# T\n\nDone: 2026-10-13\n\n## Results'), ["no '## Result'"])
  assert.deepEqual(completedProblems('# T\n\nDone: 2026-10-13\n\n```\n## Result\n```'), ["no '## Result'"])
  assert.deepEqual(completedProblems(''), ["no 'Done: yyyy-mm-dd' below the title", "no '## Result'"])
})

test('plans directories', () => {
  const dir = (name: string) => join(fileURLToPath(new URL('fixtures/plans', import.meta.url)), name)
  assert.deepEqual(planProblems(dir('good')), [])
  assert.deepEqual(planProblems(dir('missing')), [])
  assert.deepEqual(planProblems(dir('bad')), [
    `${dir('bad/20260101-finished.md')}: every box ticked, not moved to ${dir('bad/completed')}/`,
    `${dir('bad/completed/20260101-late-done.md')}: no 'Done: yyyy-mm-dd' below the title`,
    `${dir('bad/completed/20260102-no-result.md')}: no '## Result'`,
  ])
})

test('only gh not-found errors read as missing', () => {
  assert.match('gh: Not Found (HTTP 404)', TAG_NOT_FOUND)
  assert.doesNotMatch('gh: Bad credentials (HTTP 401)\n{"message": "Bad credentials", "status": "401"}', TAG_NOT_FOUND)
  assert.match('release not found', RELEASE_NOT_FOUND)
  assert.doesNotMatch('HTTP 401: Bad credentials (https://api.github.com/repos/o/r/releases/tags/v1)\nTry authenticating with:  gh auth login -h github.com', RELEASE_NOT_FOUND)
})
