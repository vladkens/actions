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
