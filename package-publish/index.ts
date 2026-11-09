import { env, fail, input, main, required, setOutput } from "../lib/core.ts"
import { bumpCask, bumpFormulaFiles, bumpTap } from "../lib/homebrew.ts"
import { releaseFiles } from "../lib/release-files.ts"
import { publishAur } from "./aur.ts"
import { parseTargets, type Target } from "./targets.ts"

await main(() => {
  // Checked on every run, so a typo shows before the first release.
  const targets = parseTargets(input("to"))
  const tag = input("tag")
  if (!tag) {
    console.log("no release in this run: nothing to publish")
    setOutput("changed", "false")
    setOutput("updated", "")
    return
  }

  // Local files are checked here; a release's assets are downloaded only when a target needs one.
  const files = releaseFiles(tag, "files")

  // Every target's inputs before any push, so a missing secret doesn't leave half a release.
  const steps: Record<Target, () => () => boolean> = {
    homebrew: () => {
      const tap = required("homebrew-tap")
      const token = required("homebrew-token")
      const cask = input("homebrew-cask")
      if (cask && input("homebrew-formula"))
        fail("set 'homebrew-formula' or 'homebrew-cask', not both")
      const formula = input("homebrew-formula") || env("GITHUB_REPOSITORY").split("/")[1]
      const version = tag.replace(/^v/, "")
      return () =>
        bumpTap({
          tap,
          token,
          tag,
          paths: cask ? [`Casks/${cask}.rb`] : [`Formula/${formula}.rb`, `${formula}.rb`],
          edit: text =>
            cask ? bumpCask(text, version, files) : bumpFormulaFiles(text, version, files),
        })
    },
    aur: () => {
      const pkg = required("aur-package")
      const key = required("aur-ssh-key")
      return () => publishAur(pkg, key, tag, files)
    },
  }
  const runs = targets.map(target => ({ target, run: steps[target]() }))

  const updated = runs.filter(({ run }) => run()).map(x => x.target)
  setOutput("changed", String(updated.length > 0))
  setOutput("updated", updated.join(" "))
})
