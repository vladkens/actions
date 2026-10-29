import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { globSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bool, env, fail, input, logText, main, mask, notice, probe, run, setOutput } from '../lib/core.ts'
import { assess, identity } from './sign.ts'

// Apple's intermediate for Developer ID certificates, which a runner's keychains may lack.
const G2 = 'https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer'
const G2_SHA256 = 'f16cd3c54c7f83cea4bf1a3e6a0819c8aaa8e4a1528fd144715f350643d2df3a'

// The run's own keychain: `sign` makes it, `notarize` or `cleanup` deletes it.
const keychain = () => join(env('RUNNER_TEMP'), 'macos-sign.keychain-db')

// The one .app in a zip, unpacked into `dir`.
function unzip(zip: string, dir: string): string {
  run('ditto', ['-x', '-k', zip, dir])
  const top = readdirSync(dir)
  if (top.length !== 1 || !top[0].endsWith('.app')) fail(`${zip}: holds ${top.join(', ')}, not one .app`)
  return join(dir, top[0])
}

function rezip(app: string, zip: string): void {
  rmSync(zip)
  run('ditto', ['-c', '-k', '--keepParent', app, zip])
}

// notarytool's JSON answer, empty when it has none (its error is in the log).
function notarytool(args: string[]): { id?: string; status?: string } {
  console.log(`$ xcrun notarytool ${args[0]} ${args[1]}`)
  const out = spawnSync('xcrun', ['notarytool', ...args, '--output-format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).stdout
  try {
    return JSON.parse(out)
  } catch {
    logText(out ?? '')
    return {}
  }
}

async function sign(zips: string[], tmp: string): Promise<void> {
  const certificate = input('certificate')
  if (bool('required') && !certificate) fail('a release needs the certificate')
  if (!certificate) return notice('no certificate (a fork?): the macOS apps keep their ad hoc signature')
  if (!zips.length) fail("input 'files' matches no files: nothing to sign")

  const ca = Buffer.from(await (await fetch(G2)).arrayBuffer())
  const sha = createHash('sha256').update(ca).digest('hex')
  if (sha !== G2_SHA256) fail(`${G2}: SHA-256 ${sha}, expected ${G2_SHA256}`)

  const secret = randomUUID()
  mask(secret)
  probe('security', ['delete-keychain', keychain()]) // a re-run's
  const list = run('security', ['list-keychains', '-d', 'user'])
  const searched = list.split('\n').map((x) => x.trim().replace(/^"|"$/g, ''))
  run('security', ['create-keychain', '-p', secret, keychain()])
  run('security', ['set-keychain-settings', keychain()]) // no lock after a timeout
  run('security', ['unlock-keychain', '-p', secret, keychain()])
  run('security', ['list-keychains', '-d', 'user', '-s', keychain(), ...searched])
  writeFileSync(join(tmp, 'g2.cer'), ca)
  run('security', ['import', join(tmp, 'g2.cer'), '-k', keychain()])
  writeFileSync(join(tmp, 'id.p12'), Buffer.from(certificate, 'base64'), { mode: 0o600 })
  const p12 = ['-f', 'pkcs12', '-P', input('certificate-password'), '-T', '/usr/bin/codesign']
  run('security', ['import', join(tmp, 'id.p12'), '-k', keychain(), ...p12])
  // codesign may use the key with no prompt.
  run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', secret, keychain()])
  const found = run('security', ['find-identity', '-p', 'codesigning', keychain()])
  const id = identity(found) ?? fail('the certificate holds no code signing identity')
  console.log(`macos-sign: ${id.name}`)
  setOutput('identity', id.hash)

  const entitlements = input('entitlements')
  for (const zip of zips) {
    const app = unzip(zip, mkdtempSync(join(tmp, 'app-')))
    // The hardened runtime and a secure timestamp, which notarization needs.
    const flags = ['--options', 'runtime', '--timestamp', ...(entitlements ? ['--entitlements', entitlements] : [])]
    run('codesign', ['--force', '--sign', id.hash, '--keychain', keychain(), ...flags, app])
    run('codesign', ['--verify', '--strict', app])
    rezip(app, zip)
  }
}

function notarize(files: string[], tmp: string): void {
  const [key, keyId, issuer] = ['api-key', 'api-key-id', 'api-issuer'].map(input)
  if (bool('required') && !key) fail('a release needs the API key')
  if (!key) return notice('no notary API key: not notarized')
  if (!(keyId && issuer)) fail("notarizing needs 'api-key', 'api-key-id' and 'api-issuer'")
  if (!files.length) fail("input 'files' matches no files: nothing to notarize")

  writeFileSync(join(tmp, 'key.p8'), key, { mode: 0o600 })
  const notary = ['--key', join(tmp, 'key.p8'), '--key-id', keyId, '--issuer', issuer]
  for (const file of files) {
    // The submission's id first, so one Apple takes long over can be looked up later.
    const submitted = notarytool(['submit', file, ...notary])
    if (!submitted.id) fail(`${file}: the upload to Apple failed`)

    console.log(`notarization: ${submitted.id}`)
    const result = notarytool(['wait', submitted.id, ...notary, '--timeout', '20m'])
    if (result.status !== 'Accepted') {
      logText(probe('xcrun', ['notarytool', 'log', submitted.id, ...notary]) ?? '')
      fail(`${file}: notarization ${submitted.id} ${result.status ?? 'not finished in 20 minutes'}`)
    }

    // A disk image takes the ticket itself; a zip can't, the app in it does.
    const target = file.endsWith('.dmg') ? file : unzip(file, mkdtempSync(join(tmp, 'app-')))
    run('xcrun', ['stapler', 'staple', target])
    run('spctl', assess(target))
    if (target !== file) rezip(target, file)
  }
}

await main(async () => {
  const step = input('step')
  if (step === 'cleanup') return void probe('security', ['delete-keychain', keychain()])
  if (process.platform !== 'darwin') fail('macos-sign needs a macOS runner')

  const globs = input('files').split('\n').map((x) => x.trim()).filter(Boolean)
  const files = globs.flatMap((x) => globSync(x)).sort()
  const tmp = mkdtempSync(join(tmpdir(), 'macos-sign-'))
  try {
    if (step === 'sign') await sign(files, tmp)
    else if (step === 'notarize') notarize(files, tmp)
    else fail(`input 'step' is 'sign', 'notarize' or 'cleanup', not '${step}'`)
  } catch (err) {
    probe('security', ['delete-keychain', keychain()])
    throw err
  } finally {
    if (step === 'notarize') probe('security', ['delete-keychain', keychain()])
    rmSync(tmp, { recursive: true, force: true })
  }
})
