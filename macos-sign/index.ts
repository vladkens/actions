import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { globSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bool, fail, input, logText, main, mask, notice, probe, run } from '../lib/core.ts'
import { identity } from './sign.ts'

// Apple's intermediate for Developer ID certificates, which a runner's keychains may lack.
const G2 = 'https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer'
const G2_SHA256 = 'f16cd3c54c7f83cea4bf1a3e6a0819c8aaa8e4a1528fd144715f350643d2df3a'

await main(async () => {
  const globs = input('files').split('\n').map((x) => x.trim()).filter(Boolean)
  const zips = globs.flatMap((x) => globSync(x)).sort()
  const certificate = input('certificate')
  const required = bool('required')
  if (required && !(certificate && input('api-key'))) fail('a release needs the certificate and the API key')
  if (!certificate) return notice('no certificate (a fork?): the macOS apps keep their ad hoc signature')
  if (!zips.length) fail(`input 'files' ('${globs.join(' ')}') matches no files: nothing to sign`)
  if (process.platform !== 'darwin') fail('macos-sign needs a macOS runner')

  const entitlements = input('entitlements')
  const [key, keyId, issuer] = ['api-key', 'api-key-id', 'api-issuer'].map(input)
  if ((key || keyId || issuer) && !(key && keyId && issuer)) {
    fail("notarizing needs 'api-key', 'api-key-id' and 'api-issuer'")
  }

  const ca = Buffer.from(await (await fetch(G2)).arrayBuffer())
  const sha = createHash('sha256').update(ca).digest('hex')
  if (sha !== G2_SHA256) fail(`${G2}: SHA-256 ${sha}, expected ${G2_SHA256}`)

  // A keychain of this run's own, deleted at the end.
  const tmp = mkdtempSync(join(tmpdir(), 'macos-sign-'))
  const keychain = join(tmp, 'sign.keychain-db')
  const secret = randomUUID()
  mask(secret)
  const list = run('security', ['list-keychains', '-d', 'user'])
  const searched = list.split('\n').map((x) => x.trim().replace(/^"|"$/g, ''))
  try {
    run('security', ['create-keychain', '-p', secret, keychain])
    run('security', ['set-keychain-settings', keychain]) // no lock after a timeout
    run('security', ['unlock-keychain', '-p', secret, keychain])
    run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...searched])
    writeFileSync(join(tmp, 'g2.cer'), ca)
    run('security', ['import', join(tmp, 'g2.cer'), '-k', keychain])
    writeFileSync(join(tmp, 'id.p12'), Buffer.from(certificate, 'base64'), { mode: 0o600 })
    const password = input('certificate-password')
    const p12 = ['-f', 'pkcs12', '-P', password, '-T', '/usr/bin/codesign']
    run('security', ['import', join(tmp, 'id.p12'), '-k', keychain, ...p12])
    // codesign may use the key with no prompt.
    run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', secret, keychain])
    const found = run('security', ['find-identity', '-p', 'codesigning', keychain])
    const id = identity(found) ?? fail('the certificate holds no code signing identity')
    console.log(`macos-sign: ${id.name}`)

    const notary = ['--key', join(tmp, 'key.p8'), '--key-id', keyId, '--issuer', issuer]
    if (key) writeFileSync(join(tmp, 'key.p8'), key, { mode: 0o600 })
    else notice('no notary API key: signed, not notarized')

    for (const zip of zips) {
      const dir = mkdtempSync(join(tmp, 'app-'))
      run('ditto', ['-x', '-k', zip, dir])
      const top = readdirSync(dir)
      if (top.length !== 1 || !top[0].endsWith('.app')) fail(`${zip}: holds ${top.join(', ')}, not one .app`)

      const app = join(dir, top[0])
      // The hardened runtime and a secure timestamp, which notarization needs.
      const flags = ['--options', 'runtime', '--timestamp', ...(entitlements ? ['--entitlements', entitlements] : [])]
      run('codesign', ['--force', '--sign', id.hash, '--keychain', keychain, ...flags, app])
      run('codesign', ['--verify', '--strict', app])
      if (key) {
        const upload = join(dir, 'notarize.zip')
        run('ditto', ['-c', '-k', '--keepParent', app, upload])
        console.log(`$ xcrun notarytool submit ${upload} --wait`)
        const args = ['notarytool', 'submit', upload, ...notary, '--wait', '--output-format', 'json']
        const out = spawnSync('xcrun', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).stdout
        let result: { id?: string; status?: string } = {}
        try {
          result = JSON.parse(out)
        } catch {
          logText(out ?? '')
        }

        if (result.status !== 'Accepted') {
          if (result.id) logText(probe('xcrun', ['notarytool', 'log', result.id, ...notary]) ?? '')
          fail(`${zip}: notarization ${result.status ?? 'failed'}`)
        }

        run('xcrun', ['stapler', 'staple', app])
        run('spctl', ['--assess', '-vv', '--type', 'exec', app])
      }

      rmSync(zip)
      run('ditto', ['-c', '-k', '--keepParent', app, zip])
    }
  } finally {
    probe('security', ['delete-keychain', keychain])
    rmSync(tmp, { recursive: true, force: true })
  }
})
