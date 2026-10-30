import { commitTitle, isReleaseTitle } from "../lib/commit.ts"
import { env, input, main, setOutput } from "../lib/core.ts"

await main(() => {
  const event = env("GITHUB_EVENT_NAME")
  const ref = env("GITHUB_REF_NAME")
  const release =
    event === "push" && ref === input("branch") && isReleaseTitle(commitTitle(input("message")))
  setOutput("release", String(release))
  console.log(`release commit: ${release} (${event} on ${ref})`)
})
