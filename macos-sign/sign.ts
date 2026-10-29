// The first identity `security find-identity` lists: `  1) <SHA-1> "<name>"`, trusted or not.
export function identity(listing: string): { hash: string; name: string } | undefined {
  const m = listing.match(/^\s*\d+\) ([0-9A-F]{40}) "([^"]+)"/m)
  return m ? { hash: m[1], name: m[2] } : undefined
}

// Gatekeeper's check of a notarized file: an app runs, a disk image opens.
export function assess(path: string): string[] {
  const kind = path.endsWith('.dmg') ? ['--type', 'open', '--context', 'context:primary-signature'] : ['--type', 'exec']
  return ['--assess', '-vv', ...kind, path]
}
