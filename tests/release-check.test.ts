import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { manifestVersion, tomlString } from '../lib/manifest.ts'
import { changelogNotes, hasEntry, isReleaser } from '../release-check/notes.ts'

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
