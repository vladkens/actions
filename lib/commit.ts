// The first line of a commit message, without the ` (#N)` a squash merge appends.
export function commitTitle(message: string): string {
  return message
    .split(/\r?\n/)[0]
    .trim()
    .replace(/ \(#\d+\)$/, "")
}

// `release: v` and a version, nothing after it: `release: version change` is no release.
export function isReleaseTitle(title: string): boolean {
  return /^release: v\d\S*$/.test(title)
}
