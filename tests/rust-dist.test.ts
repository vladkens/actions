import assert from "node:assert/strict"
import { test } from "node:test"

import { archiveName, isApple, isShipped, parseTargets, profileDir } from "../rust-dist/dist.ts"

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
