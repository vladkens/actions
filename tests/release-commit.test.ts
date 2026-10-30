import assert from "node:assert/strict"
import { test } from "node:test"

import { commitTitle, isReleaseTitle } from "../lib/commit.ts"

test("commit title drops the squash suffix and the body", () => {
  assert.equal(commitTitle("release: v1.0.1 (#12)\n\n* body"), "release: v1.0.1")
  assert.equal(commitTitle("release: v1.0.1\r\nbody"), "release: v1.0.1")
  assert.equal(commitTitle("release: v1.0.1 (#12) (#13)"), "release: v1.0.1 (#12)")
  assert.equal(commitTitle(""), "")
})

test("release titles", () => {
  for (const title of ["release: v1.0.1", "release: v2.0.0-rc.1", "release: v1"]) {
    assert.ok(isReleaseTitle(title), title)
  }

  for (const title of [
    "release: version change",
    "release: v",
    "release: v1.0.1 and more",
    "release:v1.0.1",
    "fix: v1.0.1",
    "",
  ]) {
    assert.ok(!isReleaseTitle(title), title)
  }
})
