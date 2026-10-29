import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const script = fileURLToPath(new URL('../rust-publish/files.sh', import.meta.url))

// A target/distrib with these entries: a name ending in `/` is a folder, `@` a symlink.
function distrib(entries: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'distrib-'))
  for (const entry of entries) {
    if (entry.endsWith('/')) {
      mkdirSync(join(dir, entry), { recursive: true })
    } else if (entry.startsWith('@')) {
      symlinkSync('/etc/hosts', join(dir, entry.slice(1)))
    } else {
      mkdirSync(join(dir, entry, '..'), { recursive: true })
      writeFileSync(join(dir, entry), 'x')
    }
  }

  return dir
}

function check(entries: string[], prefix: string, pack: boolean): string {
  const out = spawnSync('bash', [script, distrib(entries), prefix, String(pack)], { encoding: 'utf8' })
  return out.status === 0 ? 'ok' : out.stdout.trim()
}

test('without pack: files named <name>-dev*, nothing else', () => {
  assert.equal(check(['app-dev-x86_64-unknown-linux-gnu.tar.gz', 'app-dev-aarch64-apple-darwin.tar.gz'], 'app-dev', false), 'ok')
  assert.equal(check([], 'app-dev', false), 'ok')
  assert.match(check(['app-dev-a.zip', 'other-dev-a.zip'], 'app-dev', false), /unexpected 'other-dev-a.zip'.*'app-dev\*'$/)
  assert.match(check(['update.txt'], 'app-dev', false), /unexpected 'update.txt'/)
  assert.match(check(['x86_64-unknown-linux-gnu/app'], 'app-dev', false), /unexpected 'x86_64-unknown-linux-gnu'/)
  assert.match(check(['@app-dev-a.zip'], 'app-dev', false), /unexpected 'app-dev-a.zip'/)
  assert.match(check(['.hidden'], 'app-dev', false), /unexpected '.hidden'/)
})

test('after pack: <name>-<LABEL>-* and update.txt at the top, the binaries skipped', () => {
  const bins = ['aarch64-apple-darwin/app', 'x86_64-unknown-linux-gnu/app', 'x86_64-pc-windows-gnu/app.exe']
  assert.equal(check([...bins, 'app-v1.2.3-macos.dmg', 'app-v1.2.3-linux.AppImage', 'update.txt'], 'app-v1.2.3-', true), 'ok')
  assert.equal(check([...bins, 'app-dev-setup.exe', '.cache/'], 'app-dev-', true), 'ok')
  assert.match(check([...bins, 'app-dev-setup.exe'], 'app-v1.2.3-', true), /unexpected 'app-dev-setup.exe'.*'app-v1.2.3-\*' or 'update.txt'$/)
  assert.match(check(['app-v1.2.3'], 'app-v1.2.3-', true), /unexpected 'app-v1.2.3'/)
  assert.match(check(['@app-dev-a.dmg'], 'app-dev-', true), /unexpected 'app-dev-a.dmg'/)
  assert.match(check(['@linked'], 'app-dev-', true), /unexpected 'linked'/)
  assert.match(check(bins, 'app-dev-', true), /left no release files/)
})
