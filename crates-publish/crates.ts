// crates.io's HTTP API, and Trusted Publishing as rust-lang/crates-io-auth-action does it:
// https://crates.io/docs/trusted-publishing
import { env, fail, mask } from '../lib/core.ts'

const CRATES = 'https://crates.io'
const TOKENS = `${CRATES}/api/v1/trusted_publishing/tokens`

function userAgent(): string {
  return `vladkens/actions (github.com/${env('GITHUB_REPOSITORY')})`
}

async function check(response: Response, what: string): Promise<Response> {
  if (!response.ok) fail(`${what}: HTTP ${response.status} ${await response.text()}`)
  return response
}

export async function isPublished(name: string, version: string): Promise<boolean> {
  const url = `${CRATES}/api/v1/crates/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  const response = await fetch(url, { headers: { 'User-Agent': userAgent() } })
  if (response.status === 404) return false
  await check(response, `checking ${name} ${version} on crates.io`)
  return true
}

// The job's OIDC token for `audience`, proving which repo and workflow is running.
export async function idToken(audience: string): Promise<string> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const auth = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!url || !auth) fail("no OIDC token: the job needs 'permissions: id-token: write'")
  const response = await fetch(`${url}&audience=${encodeURIComponent(audience)}`, {
    headers: { Authorization: `Bearer ${auth}` },
  })
  await check(response, 'requesting the OIDC token')
  const { value } = (await response.json()) as { value?: string }
  if (!value) fail('the OIDC token response has no value')
  mask(value)
  return value
}

// Exchanges the OIDC token for a crates.io token valid for 30 minutes.
export async function exchange(jwt: string): Promise<string> {
  const response = await fetch(TOKENS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent() },
    body: JSON.stringify({ jwt }),
  })
  await check(response, 'getting a crates.io token (is Trusted Publishing set up for this workflow?)')
  const { token } = (await response.json()) as { token?: string }
  if (!token) fail('the crates.io token response has no token')
  mask(token)
  return token
}

export async function revoke(token: string): Promise<void> {
  const response = await fetch(TOKENS, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': userAgent() },
  })
  await check(response, 'revoking the crates.io token')
}
