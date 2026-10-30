// GitHub through the `gh` CLI preinstalled on the hosted runners, for the workflow's own repo.
import { execFileSync } from 'node:child_process'
import { env, fail, required, run } from './core.ts'

function ghEnv(): Record<string, string> {
  return { GH_TOKEN: required('token'), GH_REPO: env('GITHUB_REPOSITORY'), GH_PROMPT_DISABLED: '1' }
}

export function gh(args: string[], stream = false): string {
  return run('gh', args, { env: ghEnv(), stream })
}

// For something that may not exist: null only when gh's error says so (`notFound`), so a bad token,
// a rate limit or the network fails the step instead of reading as "not there".
export function ghFind(args: string[], notFound: RegExp): string | null {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      env: { ...process.env, ...ghEnv() },
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }).trim()
  } catch (err) {
    const stderr = String((err as { stderr?: unknown }).stderr ?? '').trim()
    if (notFound.test(stderr)) return null

    return fail(`'gh ${args.slice(0, 2).join(' ')}' failed: ${stderr.split('\n')[0] || String(err)}`)
  }
}

// gh's errors for a tag ref and a release that don't exist.
export const TAG_NOT_FOUND = /\(HTTP 404\)/
export const RELEASE_NOT_FOUND = /^release not found$/m

const api = (path: string) => `repos/${env('GITHUB_REPOSITORY')}/${path}`

// The commit a tag points to (through an annotated tag too), or null when there is no such tag.
export function tagCommit(tag: string): string | null {
  const ref = ghFind(['api', api(`git/ref/tags/${tag}`), '--jq', '.object.type + " " + .object.sha'], TAG_NOT_FOUND)
  if (!ref) return null
  const [type, sha] = ref.split(' ')
  return type === 'tag' ? gh(['api', api(`git/tags/${sha}`), '--jq', '.object.sha']) : sha
}

export function branchCommit(branch: string): string {
  return gh(['api', api(`git/ref/heads/${branch}`), '--jq', '.object.sha'])
}

// Creates the tag, or moves it with `force`. The tag is lightweight, as `git tag` makes it.
export function setTag(tag: string, sha: string, force = false): void {
  if (force && tagCommit(tag) !== null) {
    gh(['api', '-X', 'PATCH', api(`git/refs/tags/${tag}`), '-f', `sha=${sha}`, '-F', 'force=true'])
  } else {
    gh(['api', '-X', 'POST', api('git/refs'), '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`])
  }
}

export type Release = { isDraft: boolean; assets: string[] }

export function findRelease(tag: string): Release | null {
  const out = ghFind(['release', 'view', tag, '--json', 'isDraft,assets'], RELEASE_NOT_FOUND)
  if (out === null) return null
  const json = JSON.parse(out) as { isDraft: boolean; assets: { name: string }[] }
  return { isDraft: json.isDraft, assets: json.assets.map((x) => x.name) }
}
