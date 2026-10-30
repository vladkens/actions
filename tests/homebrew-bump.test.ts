import assert from "node:assert/strict"
import { test } from "node:test"

import { bumpFormula } from "../homebrew-bump/formula.ts"

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
