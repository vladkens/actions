import { basename } from "node:path"

import { env, files, input, main, notice, required, setOutput } from "../lib/core.ts"
import { branchCommit, findRelease, gh, setTag } from "../lib/github.ts"

await main(() => {
  const tag = required("tag")
  const sha = env("GITHUB_SHA")
  const branch = env("GITHUB_REF_NAME")
  const paths = files("files")

  // A newer push has its own build coming: don't let this older one overwrite it.
  if (env("GITHUB_REF").startsWith("refs/heads/") && branchCommit(branch) !== sha) {
    notice(`${branch} has moved past ${sha}, skipping the ${tag} release`)
    setOutput("skipped", "true")
    return
  }

  const time = new Date().toISOString().slice(0, 16).replace("T", " ")
  const title = required("title")
  const notes = input("notes") || `Latest build of \`${branch}\` at ${sha} (${time} UTC).`

  setTag(tag, sha, true)
  const release = findRelease(tag)
  if (!release) {
    gh(
      [
        "release",
        "create",
        tag,
        ...paths,
        "--verify-tag",
        "--prerelease",
        "--title",
        title,
        "--notes",
        notes,
      ],
      true,
    )
  } else {
    gh(["release", "upload", tag, ...paths, "--clobber"], true)
    const names = paths.map(x => basename(x))
    for (const stale of release.assets.filter(x => !names.includes(x))) {
      gh(["release", "delete-asset", tag, stale, "--yes"])
    }
    gh([
      "release",
      "edit",
      tag,
      "--prerelease",
      "--draft=false",
      "--title",
      title,
      "--notes",
      notes,
    ])
  }

  setOutput("skipped", "false")
  setOutput("files", paths.join("\n"))
})
