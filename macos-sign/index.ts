import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, globSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { bool, fail, input, logText, main, mask, notice, probe, run } from '../lib/core.ts'
import { identity } from './sign.ts'

// Apple's intermediate for Developer ID certificates, which a runner's keychains may lack.
const G2 = 'https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer'
const G2_SHA256 = 'f16cd3c54c7f83cea4bf1a3e6a0819c8aaa8e4a1528fd144715f350643d2df3a'

await main(async () => {
  const globs = input('files').split('\n').map((x) => x.trim()).filter(Boolean)
  const dmgs = globs.flatMap((x) => globSync(x)).sort()
  const certificate = input('certificate')
  const required = bool('required')
  if (required && !(certificate && input('api-key'))) fail('a release needs the certificate and the API key')
  if (!certificate) return notice('no certificate (a fork?): the macOS apps keep their ad hoc signature')
  if (!dmgs.length) fail(`input 'files' ('${globs.join(' ')}') matches no files: nothing to sign`)
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

    for (const dmg of dmgs) {
      // The .app out of the image, which is made again around the signed one.
      const dir = mkdtempSync(join(tmp, 'dmg-'))
      const [mnt, root, out] = [join(dir, 'mnt'), join(dir, 'root'), join(dir, basename(dmg))]
      run('hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mnt, dmg])
      const apps = readdirSync(mnt).filter((x) => x.endsWith('.app'))
      if (apps.length === 1) run('ditto', [join(mnt, apps[0]), join(root, apps[0])])
      run('hdiutil', ['detach', mnt])
      if (apps.length !== 1) fail(`${dmg}: holds ${apps.length} .app, not one`)

      const app = join(root, apps[0])
      // The hardened runtime and a secure timestamp, which notarization needs.
      const flags = ['--options', 'runtime', '--timestamp', ...(entitlements ? ['--entitlements', entitlements] : [])]
      run('codesign', ['--force', '--sign', id.hash, '--keychain', keychain, ...flags, app])
      run('codesign', ['--verify', '--strict', app])
      symlinkSync('/Applications', join(root, 'Applications'))
      const name = apps[0].replace(/\.app$/, '')
      run('hdiutil', ['create', '-volname', name, '-srcfolder', root, '-format', 'UDZO', out])
      run('codesign', ['--force', '--sign', id.hash, '--keychain', keychain, '--timestamp', out])
      if (key) {
        // One submission: the image and the app in it.
        console.log(`$ xcrun notarytool submit ${out} --wait`)
        const args = ['notarytool', 'submit', out, ...notary, '--wait', '--output-format', 'json']
        const json = spawnSync('xcrun', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).stdout
        let result: { id?: string; status?: string } = {}
        try {
          result = JSON.parse(json)
        } catch {
          logText(json ?? '')
        }

        if (result.status !== 'Accepted') {
          if (result.id) logText(probe('xcrun', ['notarytool', 'log', result.id, ...notary]) ?? '')
          fail(`${dmg}: notarization ${result.status ?? 'failed'}`)
        }

        run('xcrun', ['stapler', 'staple', out])
        run('spctl', ['--assess', '-vv', '--type', 'open', '--context', 'context:primary-signature', out])
      }

      copyFileSync(out, dmg)
    }
  } finally {
    probe('security', ['delete-keychain', keychain])
    rmSync(tmp, { recursive: true, force: true })
  }
})
