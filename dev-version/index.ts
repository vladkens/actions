import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fail, input, main, notice, probe, run, setOutput } from '../lib/core.ts'
import { devVersion, setLockVersion, setManifestVersion } from './stamp.ts'

type Metadata = { workspace_root: string; packages: { name: string; version: string; manifest_path: string }[] }

const metadata = (manifest: string) =>
  JSON.parse(run('cargo', ['metadata', '--no-deps', '--format-version', '1', '--manifest-path', manifest])) as Metadata

await main(() => {
  const manifest = input('manifest-path')
  const meta = metadata(manifest)
  const own = realpathSync(manifest)
  const pkg = meta.packages.find((x) => realpathSync(x.manifest_path) === own)
  if (!pkg) {
    notice(`${manifest} has no [package]: version left as is`)
    return
  }

  // `git describe` needs the history and the tags; actions/checkout fetches one commit.
  if (run('git', ['rev-parse', '--is-shallow-repository']) === 'true') {
    run('git', ['fetch', '--quiet', '--unshallow', '--filter=tree:0', '--tags', 'origin'])
  } else {
    run('git', ['fetch', '--quiet', '--tags', 'origin'])
  }
  // Release tags only: not `dev` or a moving major tag like `v1`.
  const described = probe('git', ['describe', '--tags', '--match', 'v[0-9]*.[0-9]*.[0-9]*'])
  const version = devVersion(described, pkg.version, run('git', ['rev-parse', '--short', 'HEAD']))
  setOutput('version', version)
  if (version === pkg.version) {
    console.log(`${pkg.name} ${version}: a tagged commit, version left as is`)
    return
  }

  const toml = setManifestVersion(readFileSync(manifest, 'utf8'), version)
  if (toml === undefined) fail(`${manifest} has no literal [package] version to stamp`)
  writeFileSync(manifest, toml)
  const lockPath = join(meta.workspace_root, 'Cargo.lock')
  if (existsSync(lockPath)) {
    const lock = setLockVersion(readFileSync(lockPath, 'utf8'), pkg.name, pkg.version, version)
    if (lock === undefined) fail(`${lockPath} has no entry for ${pkg.name} ${pkg.version}`)
    writeFileSync(lockPath, lock)
  }

  const stamped = metadata(manifest).packages.find((x) => x.name === pkg.name)?.version
  if (stamped !== version) fail(`cargo reads ${pkg.name} ${stamped} after stamping ${version}`)
  console.log(`${pkg.name} ${pkg.version} → ${version}`)
})
