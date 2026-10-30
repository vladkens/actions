import type { Release } from "../lib/github.ts"

type AssetStep = "upload" | "replace" | "download"

// What a re-run does with each file. A published release keeps its assets: they are downloaded
// over the local files, and only missing ones are uploaded. A draft is what's left of a failed
// `gh release create` whose cleanup failed too; it was never public, so every file replaces its
// asset, and a pack's feed (update.txt) describes the bytes that go out.
export function assetSteps(release: Release, names: string[]): AssetStep[] {
  return names.map(name => {
    if (release.isDraft) return "replace"
    return release.assets.includes(name) ? "download" : "upload"
  })
}
