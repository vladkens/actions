import assert from "node:assert/strict"
import { test } from "node:test"

import { devVersion, setLockVersion, setManifestVersion } from "../dev-version/stamp.ts"

test("dev version from git describe, else the manifest version and the commit", () => {
  assert.equal(devVersion("v0.9.0-12-g3672a1b", "0.9.0", "3672a1b"), "0.9.0-12-g3672a1b")
  assert.equal(devVersion("v0.9.0", "0.9.0", "3672a1b"), "0.9.0")
  assert.equal(devVersion(null, "0.1.0", "3672a1b"), "0.1.0-g3672a1b")
})

test("manifest: only [package] version changes", () => {
  const text = '[package]\nname = "x"\nversion = "0.9.0" # here\n\n[dependencies]\nversion = "1"\n'
  assert.equal(
    setManifestVersion(text, "0.9.0-1-gabc"),
    '[package]\nname = "x"\nversion = "0.9.0-1-gabc" # here\n\n[dependencies]\nversion = "1"\n',
  )
  assert.equal(
    setManifestVersion('[package]\nname = "x"\nversion.workspace = true\n', "1"),
    undefined,
  )
  assert.equal(setManifestVersion("[workspace]\nmembers = []\n", "1"), undefined)
})

test("lock: only the local package entry changes", () => {
  const lock = [
    "version = 4",
    "",
    "[[package]]",
    'name = "x"',
    'version = "0.9.0"',
    'source = "registry+https://github.com/rust-lang/crates.io-index"',
    "",
    "[[package]]",
    'name = "x"',
    'version = "0.9.0"',
    "dependencies = [",
    ' "y",',
    "]",
    "",
  ].join("\n")
  const stamped = setLockVersion(lock, "x", "0.9.0", "0.9.0-1-gabc")
  assert.ok(stamped)
  assert.equal(stamped.split('version = "0.9.0-1-gabc"').length, 2)
  assert.match(stamped, /source = "registry[^\n]*"\n/)
  assert.match(stamped, /name = "x"\nversion = "0\.9\.0"\nsource/)
  assert.equal(setLockVersion(lock, "z", "0.9.0", "1"), undefined)
})

test("a CRLF checkout (Windows) is stamped and keeps its line ends", () => {
  const crlf = (s: string) => s.replace(/\n/g, "\r\n")
  const toml = crlf('[package]\nname = "x"\nversion = "0.9.0"\n')
  assert.equal(
    setManifestVersion(toml, "0.9.0-1-gabc"),
    crlf('[package]\nname = "x"\nversion = "0.9.0-1-gabc"\n'),
  )
  const lock = crlf('version = 4\n\n[[package]]\nname = "x"\nversion = "0.9.0"\n')
  assert.equal(
    setLockVersion(lock, "x", "0.9.0", "0.9.0-1-gabc"),
    crlf('version = 4\n\n[[package]]\nname = "x"\nversion = "0.9.0-1-gabc"\n'),
  )
})
