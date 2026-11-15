import assert from "node:assert/strict"
import { test } from "node:test"

import {
  archiveName,
  isApple,
  isShipped,
  parseTargets,
  profileDir,
  settledVersions,
} from "../rust-dist/dist.ts"

test("targets from spaces, commas and lines", () => {
  assert.deepEqual(parseTargets(" a-apple-darwin, b-unknown-linux-gnu\nc-pc-windows-gnu "), [
    "a-apple-darwin",
    "b-unknown-linux-gnu",
    "c-pc-windows-gnu",
  ])
  assert.deepEqual(parseTargets(""), [])
})

test("archive names", () => {
  assert.equal(
    archiveName("unjar", "aarch64-apple-darwin"),
    "unjar-dev-aarch64-apple-darwin.tar.gz",
  )
  assert.equal(
    archiveName("clankr", "x86_64-pc-windows-gnu"),
    "clankr-dev-x86_64-pc-windows-gnu.zip",
  )
  assert.equal(isApple("x86_64-apple-darwin"), true)
  assert.equal(isApple("x86_64-unknown-linux-gnu"), false)
})

test("shipped files: the readme and license files only", () => {
  const files = [
    "readme.md",
    "README.md",
    "LICENSE",
    "LICENSE-MIT",
    "license.txt",
    "COPYING",
    "Cargo.toml",
    "readme-old.md",
    "licenses",
  ]
  assert.deepEqual(files.filter(isShipped), [
    "readme.md",
    "README.md",
    "LICENSE",
    "LICENSE-MIT",
    "license.txt",
    "COPYING",
  ])
})

test("profile directories", () => {
  assert.equal(profileDir("release"), "release")
  assert.equal(profileDir("dist"), "dist")
  assert.equal(profileDir("dev"), "debug")
})

test("settled versions: final and post, a week old, nothing yanked, newest first", () => {
  const at = (day: number, yanked = false) => ({
    upload_time_iso_8601: new Date(Date.UTC(2026, 10, day)).toISOString(),
    yanked,
  })
  const releases = {
    "0.9.0": [at(1)],
    "0.9.1": [at(1)],
    "0.10.0": [at(2), at(3)],
    "0.10.1": [at(4, true)],
    "0.11.0rc1": [at(4)],
    "0.11.0": [at(4), at(9)],
    "0.12.0": [at(9)],
    "0.9.0.post1": [at(5)],
    "0.9.post2": [at(5)],
    "0.9.0.post0": [at(5)],
    "0.13.0": [],
  }
  assert.deepEqual(settledVersions(releases, Date.UTC(2026, 10, 8)), [
    "0.10.0",
    "0.9.1",
    "0.9.post2",
    "0.9.0.post1",
    "0.9.0.post0",
    "0.9.0",
  ])
})
