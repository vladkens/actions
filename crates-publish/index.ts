import { bool, fail, input, main, notice, run, saveState, setOutput } from '../lib/core.ts'
import { exchange, idToken, isPublished, revoke } from './crates.ts'

type Metadata = { workspace_root: string; packages: { name: string; version: string; manifest_path: string }[] }

await main(async () => {
  const manifest = input('manifest-path')
  const meta = JSON.parse(
    run('cargo', ['metadata', '--no-deps', '--format-version', '1', '--manifest-path', manifest]),
  ) as Metadata
  const name = input('package')
  const pkg = name
    ? meta.packages.find((x) => x.name === name)
    : meta.packages.length === 1
      ? meta.packages[0]
      : meta.packages.find((x) => x.manifest_path === `${meta.workspace_root}/Cargo.toml`)
  if (!pkg) fail(name ? `no package '${name}' in ${manifest}` : `${manifest} is a workspace: set 'package'`)

  if (await isPublished(pkg.name, pkg.version)) {
    notice(`${pkg.name} ${pkg.version} is already on crates.io`)
    setOutput('skipped', 'true')
    return
  }
  setOutput('skipped', 'false')

  const args = ['publish', '--locked', '--manifest-path', manifest, '--package', pkg.name]
  if (bool('no-verify')) args.push('--no-verify')
  if (bool('dry-run')) {
    // With `id-token: write`, also prove the OIDC request works, without exchanging the token.
    if (process.env.ACTIONS_ID_TOKEN_REQUEST_URL) await idToken('crates.io')
    run('cargo', [...args, '--dry-run'], { stream: true })
    return
  }

  const token = await exchange(await idToken('crates.io'))
  saveState('token', token) // the post step revokes it if this step is cancelled
  try {
    run('cargo', args, { env: { CARGO_REGISTRY_TOKEN: token }, stream: true })
  } finally {
    await revoke(token)
    saveState('token', '')
  }
})
