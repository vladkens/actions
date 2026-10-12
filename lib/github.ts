// GitHub through the `gh` CLI preinstalled on the hosted runners, for the workflow's own repo.
import { env, probe, required, run } from './core.ts'

function ghEnv(): Record<string, string> {
  return { GH_TOKEN: required('token'), GH_REPO: env('GITHUB_REPOSITORY'), GH_PROMPT_DISABLED: '1' }
}

export function gh(args: string[], stream = false): string {
  return run('gh', args, { env: ghEnv(), stream })
}

export function ghProbe(args: string[]): string | null {
  return probe('gh', args, { env: ghEnv() })
}

const api = (path: string) => `repos/${env('GITHUB_REPOSITORY')}/${path}`

// The commit a tag points to (through an annotated tag too), or null when there is no such tag.
export function tagCommit(tag: string): string | null {
  const ref = ghProbe(['api', api(`git/ref/tags/${tag}`), '--jq', '.object.type + " " + .object.sha'])
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
  const out = ghProbe(['release', 'view', tag, '--json', 'isDraft,assets'])
  if (out === null) return null
  const json = JSON.parse(out) as { isDraft: boolean; assets: { name: string }[] }
  return { isDraft: json.isDraft, assets: json.assets.map((x) => x.name) }
}
