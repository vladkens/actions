// Targets as listed in the input: separated by spaces, commas or newlines.
export function parseTargets(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean)
}

export function isApple(target: string): boolean {
  return target.endsWith('-apple-darwin')
}

export function isWindows(target: string): boolean {
  return target.includes('-windows-')
}

export function archiveName(name: string, target: string): string {
  return `${name}-dev-${target}.${isWindows(target) ? 'zip' : 'tar.gz'}`
}

// The files shipped next to the binaries: the readme and every license file.
export function isShipped(file: string): boolean {
  return /^readme(\.md)?$/i.test(file) || /^(licen[cs]e|copying)([.-]|$)/i.test(file)
}
