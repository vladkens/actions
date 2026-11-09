import assert from "node:assert/strict"
import { test } from "node:test"

import { bumpFormula, bumpFormulaArchives } from "../lib/homebrew.ts"

const formula = `class Macmon < Formula
  desc "Sudoless performance monitoring for Apple Silicon"
  homepage "https://github.com/vladkens/macmon"
  url "https://github.com/vladkens/macmon/releases/download/v0.8.0/macmon-v0.8.0.tar.gz"
  version "0.8.0"
  sha256 "aaaa"

  def install
    bin.install "macmon"
  end
end
`

test("formula: url, sha256 and version set", () => {
  const out = bumpFormula(formula, "0.9.0", "https://example.com/macmon-v0.9.0.tar.gz", "bbbb")
  assert.match(out, /^ {2}url "https:\/\/example\.com\/macmon-v0\.9\.0\.tar\.gz"$/m)
  assert.match(out, /^ {2}version "0\.9\.0"$/m)
  assert.match(out, /^ {2}sha256 "bbbb"$/m)
  assert.match(out, /homepage "https:\/\/github\.com\/vladkens\/macmon"/)
  assert.equal(bumpFormula(out, "0.9.0", "https://example.com/macmon-v0.9.0.tar.gz", "bbbb"), out)
})

test("formula: version is optional, a second url is refused", () => {
  const noVersion = formula.replace(/^ {2}version .*\n/m, "")
  assert.doesNotMatch(bumpFormula(noVersion, "1.0.0", "u", "s"), /version/)
  const twoUrls = formula.replace(
    '  sha256 "aaaa"',
    '  sha256 "aaaa"\n  on_intel do\n    url "x"\n  end',
  )
  assert.throws(() => bumpFormula(twoUrls, "1.0.0", "u", "s"), /2 'url' lines/)
  assert.throws(() => bumpFormula("class X < Formula\nend\n", "1", "u", "s"), /no 'url/)
})

const platforms = `class Wavo < Formula
  url "https://x/v0.4.0/wavo-v0.4.0-aarch64-apple-darwin.tar.gz"
  version "0.4.0"
  sha256 "aaaa"

  on_linux do
    on_arm do
      url "https://x/v0.4.0/wavo-v0.4.0-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "bbbb"
    end
    on_intel do
      url "https://x/v0.4.0/wavo-v0.4.0-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "cccc"
    end
  end
end
`

const archives = [
  { url: "https://x/v1.0.0/wavo-v1.0.0-aarch64-unknown-linux-gnu.tar.gz", sha256: "1111" },
  { url: "https://x/v1.0.0/wavo-v1.0.0-x86_64-pc-windows-gnu.zip", sha256: "2222" },
  { url: "https://x/v1.0.0/wavo-v1.0.0-x86_64-unknown-linux-gnu.tar.gz", sha256: "3333" },
  { url: "https://x/v1.0.0/wavo-v1.0.0-aarch64-apple-darwin.tar.gz", sha256: "4444" },
]

test("formula: each platform's url and sha256 set from its archive", () => {
  const out = bumpFormulaArchives(platforms, "1.0.0", archives)
  const expected = platforms
    .replaceAll("0.4.0", "1.0.0")
    .replace("aaaa", "4444")
    .replace("bbbb", "1111")
    .replace("cccc", "3333")
  assert.equal(out, expected)
  assert.equal(bumpFormulaArchives(out, "1.0.0", archives), out)
})

test("formula: a url without an archive or a sha256 is refused", () => {
  assert.throws(() => bumpFormulaArchives(platforms, "1.0.0", archives.slice(1)), /no file/)
  const noSha = platforms.replace('      sha256 "bbbb"\n', "")
  assert.throws(() => bumpFormulaArchives(noSha, "1.0.0", archives), /needs a 'sha256'/)
  assert.throws(() => bumpFormulaArchives("class X < Formula\nend\n", "1", archives), /no 'url/)
})
