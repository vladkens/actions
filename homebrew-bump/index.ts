import { basename } from "node:path"

import { env, fail, files, input, main, required, setOutput } from "../lib/core.ts"
import { bumpFormulaFiles, bumpTap } from "../lib/homebrew.ts"
import { releaseUrl, sha256File } from "../lib/release-files.ts"

await main(() => {
  const tag = input("tag")
  if (!tag) {
    console.log("no release in this run: nothing to bump")
    setOutput("changed", "false")
    return
  }

  required("file")
  const paths = files("file")
  if (paths.length > 1 && input("url"))
    fail("'url' is for one file; several use their release assets")
  const tap = required("tap")
  const formula = input("formula") || `${env("GITHUB_REPOSITORY").split("/")[1]}.rb`
  const archives = paths.map(file => ({
    url: input("url") || releaseUrl(tag, basename(file)),
    sha256: sha256File(file),
  }))

  const changed = bumpTap({
    tap,
    token: required("token"),
    tag,
    paths: [formula],
    edit: text => bumpFormulaFiles(text, tag.replace(/^v/, ""), archives),
  })
  setOutput("changed", String(changed))
})
