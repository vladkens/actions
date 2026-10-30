import assert from "node:assert/strict"
import { test } from "node:test"

import { fail, main } from "../lib/core.ts"

// The lines main prints for a failing body, and the exit code it sets.
const failing = async (expect: string | undefined) => {
  const saved = process.env.EXPECT_FAILURE
  const log = console.log
  const lines: string[] = []
  if (expect === undefined) delete process.env.EXPECT_FAILURE
  else process.env.EXPECT_FAILURE = expect

  console.log = (line: string) => lines.push(line)
  try {
    await main(() => fail("expected x, got y"))
  } finally {
    console.log = log
    if (saved === undefined) delete process.env.EXPECT_FAILURE
    else process.env.EXPECT_FAILURE = saved
  }

  const code = process.exitCode
  process.exitCode = 0
  return { text: lines.join("\n"), code }
}

test("a failure is one ::error:: line and a failed step", async () => {
  assert.deepEqual(await failing(undefined), { text: "::error::expected x, got y", code: 1 })
  assert.deepEqual(await failing(""), { text: "::error::expected x, got y", code: 1 })
})

test("an expected failure (EXPECT_FAILURE) is a plain line, the step still fails", async () => {
  const { text, code } = await failing("1")
  assert.match(text, /^expected failure: expected x, got y$/m)
  assert.doesNotMatch(text, /::error::/)
  assert.equal(code, 1)
})
