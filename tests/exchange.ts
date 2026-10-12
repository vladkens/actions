// The token exchange against the real crates.io, in CI with `id-token: write`. This repo has no
// Trusted Publishing config there, so crates.io must refuse the token: that proves the request's
// shape and audience without publishing anything.
import { Failure } from '../lib/core.ts'
import { exchange, idToken } from '../crates-publish/crates.ts'

try {
  await exchange(await idToken('crates.io'))
  console.log('crates.io issued a token for this repo, but it has no Trusted Publishing config')
  process.exit(1)
} catch (err) {
  // crates.io read the token's claims and found no config: anything else is a broken request.
  if (!(err instanceof Failure) || !/HTTP 400 .*No Trusted Publishing config found/.test(err.message)) throw err
  console.log(`refused as expected: ${err.message}`)
}
