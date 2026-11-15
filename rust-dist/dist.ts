// Targets as listed in the input: separated by spaces, commas or newlines.
export const parseTargets = (text: string): string[] => {
  return text.split(/[\s,]+/).filter(Boolean)
}

export const isApple = (target: string): boolean => {
  return target.endsWith("-apple-darwin")
}

export const isWindows = (target: string): boolean => {
  return target.includes("-windows-")
}

export const archiveName = (name: string, target: string): string => {
  return `${name}-dev-${target}.${isWindows(target) ? "zip" : "tar.gz"}`
}

// The files shipped next to the binaries: the readme and every license file.
export const isShipped = (file: string): boolean => {
  return /^readme(\.md)?$/i.test(file) || /^(licen[cs]e|copying)([.-]|$)/i.test(file)
}

// The directory cargo builds a profile into: `dev` builds into `debug`.
export const profileDir = (profile: string): string => {
  return profile === "dev" ? "debug" : profile
}

type PypiFile = { upload_time_iso_8601: string; yanked: boolean }

// Final releases (post-releases too), newest first, whose files were all uploaded before `before`
// and none is yanked: a wheel added later to an old release makes it new again.
export const settledVersions = (releases: Record<string, PypiFile[]>, before: number): string[] => {
  // "0.17.0.post1" -> [0, 17, 0] and 1; without a post-release -1, so it comes before ".post0"
  const parts = (v: string) => {
    const [base, post] = v.split(".post")
    return { base: base.split(".").map(Number), post: post === undefined ? -1 : Number(post) }
  }
  const newer = (a: string, b: string) => {
    const [x, y] = [parts(a), parts(b)]
    for (let i = 0; i < Math.max(x.base.length, y.base.length); i++) {
      const d = (y.base[i] ?? 0) - (x.base[i] ?? 0)
      if (d) return d
    }
    return y.post - x.post
  }
  return Object.entries(releases)
    .filter(([v, files]) => /^\d+(\.\d+)*(\.post\d+)?$/.test(v) && files.length > 0)
    .filter(([, files]) =>
      files.every(f => !f.yanked && Date.parse(f.upload_time_iso_8601) < before),
    )
    .map(([v]) => v)
    .sort(newer)
}
