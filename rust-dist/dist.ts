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

// Final releases, newest first, whose files were all uploaded before `before` and none is yanked:
// a wheel added later to an old release makes it new again.
export const settledVersions = (releases: Record<string, PypiFile[]>, before: number): string[] => {
  const parts = (v: string) => v.split(".").map(Number)
  const newer = (a: string, b: string) => {
    const [x, y] = [parts(a), parts(b)]
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0)
    }
    return 0
  }
  return Object.entries(releases)
    .filter(([v, files]) => /^\d+(\.\d+)*$/.test(v) && files.length > 0)
    .filter(([, files]) =>
      files.every(f => !f.yanked && Date.parse(f.upload_time_iso_8601) < before),
    )
    .map(([v]) => v)
    .sort(newer)
}
