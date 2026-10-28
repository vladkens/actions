// The first identity `security find-identity` lists: `  1) <SHA-1> "<name>"`, trusted or not.
export function identity(listing: string): { hash: string; name: string } | undefined {
  const m = listing.match(/^\s*\d+\) ([0-9A-F]{40}) "([^"]+)"/m)
  return m ? { hash: m[1], name: m[2] } : undefined
}
