import { env, fail } from '../lib/core.ts'

export async function isPublished(name: string, version: string): Promise<boolean> {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  const response = await fetch(url, {
    headers: { 'User-Agent': `vladkens/actions (github.com/${env('GITHUB_REPOSITORY')})` },
  })
  if (response.status === 404) return false
  if (!response.ok) fail(`checking ${name} ${version} on crates.io: HTTP ${response.status} ${await response.text()}`)
  return true
}
