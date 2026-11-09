import assert from "node:assert/strict"
import { test } from "node:test"

import { bumpCask, bumpFormulaFiles } from "../lib/homebrew.ts"
import { bumpAur } from "../package-publish/aur.ts"
import { parseTargets } from "../package-publish/targets.ts"

test("to: commas, spaces and newlines, in order without repeats", () => {
  assert.deepEqual(parseTargets("homebrew, aur"), ["homebrew", "aur"])
  assert.deepEqual(parseTargets("aur homebrew"), ["aur", "homebrew"])
  assert.deepEqual(parseTargets("\n  homebrew\n  aur,\n homebrew\n"), ["homebrew", "aur"])
  assert.deepEqual(parseTargets("aur"), ["aur"])
})

test("to: an unknown or no package manager is refused", () => {
  assert.throws(() => parseTargets("homebrew, brew"), /unknown package manager 'brew'/)
  assert.throws(() => parseTargets("Homebrew"), /unknown package manager 'Homebrew'/)
  assert.throws(() => parseTargets(" , \n"), /'to' is empty/)
})

const pkgbuild = `# Maintainer: vladkens
pkgname=wavo-app-bin
pkgver=0.4.0
pkgrel=2
pkgdesc="Local speech to text"
arch=('x86_64' 'aarch64')
url="https://github.com/vladkens/wavo-app"
license=('MIT')
depends=('alsa-lib')
source_x86_64=("https://github.com/vladkens/wavo-app/releases/download/v$pkgver/Wavo-v\${pkgver}-linux-x86_64.deb")
source_aarch64=("wavo.deb::https://github.com/vladkens/wavo-app/releases/download/v$pkgver/Wavo-v\${pkgver}-linux-aarch64.deb")
sha256sums_x86_64=('aaaa')
sha256sums_aarch64=(
  'bbbb'
)

package() {
  bsdtar -xf data.tar.zst -C "$pkgdir"
}
`

const srcinfo = `pkgbase = wavo-app-bin
\tpkgdesc = Local speech to text
\tpkgver = 0.4.0
\tpkgrel = 2
\turl = https://github.com/vladkens/wavo-app
\tarch = x86_64
\tarch = aarch64
\tlicense = MIT
\tdepends = alsa-lib
\tsource_x86_64 = https://github.com/vladkens/wavo-app/releases/download/v0.4.0/Wavo-v0.4.0-linux-x86_64.deb
\tsha256sums_x86_64 = aaaa
\tsource_aarch64 = wavo.deb::https://github.com/vladkens/wavo-app/releases/download/v0.4.0/Wavo-v0.4.0-linux-aarch64.deb
\tsha256sums_aarch64 = bbbb

pkgname = wavo-app-bin
`

const release = "https://github.com/vladkens/wavo-app/releases/download/v1.0.0"
const file = (name: string, sha256: string) => ({ name, url: `${release}/${name}`, sha256 })
const files = [
  file("Wavo-v1.0.0-linux-aarch64.deb", "2222"),
  file("Wavo-v1.0.0-linux-x86_64.AppImage", "9999"),
  file("Wavo-v1.0.0-linux-x86_64.deb", "1111"),
  file("Wavo-v1.0.0-macos-aarch64.dmg", "8888"),
]

test("aur: pkgver, pkgrel and each arch's checksum set in PKGBUILD and .SRCINFO", () => {
  const out = bumpAur({ pkgbuild, srcinfo }, "1.0.0", files)
  const expectedPkgbuild = pkgbuild
    .replace("pkgver=0.4.0", "pkgver=1.0.0")
    .replace("pkgrel=2", "pkgrel=1")
    .replace("('aaaa')", "('1111')")
    .replace("(\n  'bbbb'\n)", "('2222')")
  assert.equal(out.pkgbuild, expectedPkgbuild)
  const expectedSrcinfo = srcinfo
    .replaceAll("0.4.0", "1.0.0")
    .replace("pkgrel = 2", "pkgrel = 1")
    .replace("= aaaa", "= 1111")
    .replace("= bbbb", "= 2222")
  assert.equal(out.srcinfo, expectedSrcinfo)
})

test("aur: a package already at the version is left alone, files untouched", () => {
  const out = bumpAur({ pkgbuild, srcinfo }, "1.0.0", files)
  const untouchable = [
    {
      name: "x-linux-x86_64.deb",
      url: "x",
      get sha256(): string {
        throw new Error("downloaded on a re-run")
      },
    },
  ]
  assert.equal(bumpAur(out, "1.0.0", untouchable), out)
})

test("aur: a source that isn't the release file at the new version is refused", () => {
  const fixed = pkgbuild.replace("Wavo-v${pkgver}-linux-x86_64", "Wavo-v0.4.0-linux-x86_64")
  assert.throws(
    () => bumpAur({ pkgbuild: fixed, srcinfo }, "1.0.0", files),
    /version only as \$pkgver/,
  )
  const elsewhere = pkgbuild.replaceAll("github.com/vladkens", "example.com/vladkens")
  assert.throws(
    () => bumpAur({ pkgbuild: elsewhere, srcinfo }, "1.0.0", files),
    /PKGBUILD's source/,
  )
})

test("aur: a version that isn't a plain pkgver is refused", () => {
  assert.throws(() => bumpAur({ pkgbuild, srcinfo }, "$(id)", files), /can't be a pkgver/)
  assert.throws(() => bumpAur({ pkgbuild, srcinfo }, "1.0.0-rc.1", files), /can't be a pkgver/)
})

test("aur: missing files and broken packages are refused", () => {
  assert.throws(
    () => bumpAur({ pkgbuild, srcinfo }, "1.0.0", files.slice(1)),
    /one release file \*-linux-aarch64\.deb for the AUR, found none/,
  )
  const renamed = files.map(x => file(x.name.replace("Wavo", "wavo"), x.sha256))
  assert.throws(() => bumpAur({ pkgbuild, srcinfo }, "1.0.0", renamed), /PKGBUILD's source/)
  const stale = srcinfo.replace("pkgver = 0.4.0", "pkgver = 0.3.0")
  assert.throws(() => bumpAur({ pkgbuild, srcinfo: stale }, "1.0.0", files), /differs from/)
  const two = pkgbuild.replace("('aaaa')", "('aaaa' 'cccc')")
  assert.throws(() => bumpAur({ pkgbuild: two, srcinfo }, "1.0.0", files), /one quoted entry/)
  const noSums = pkgbuild.replace(/^sha256sums_.*$/gm, "").replace(/^ {2}'bbbb'\n\)\n/m, "")
  assert.throws(() => bumpAur({ pkgbuild: noSums, srcinfo }, "1.0.0", files), /no sha256sums_/)
})

const cask = `cask "wavo-app" do
  version "0.4.0"
  sha256 "aaaa"

  url "https://github.com/vladkens/wavo-app/releases/download/v#{version}/Wavo-v#{version}-macos-aarch64.dmg"
  name "Wavo"
  homepage "https://github.com/vladkens/wavo-app"

  app "Wavo.app"
end
`

const archives = [files[2], files[3]]

test("cask: version and sha256 set, a url with #{version} kept", () => {
  const out = bumpCask(cask, "1.0.0", archives)
  assert.equal(out, cask.replace('"0.4.0"', '"1.0.0"').replace('"aaaa"', '"8888"'))
  assert.equal(bumpCask(out, "1.0.0", archives), out)
})

test("cask: a literal url moves to the file of the same name", () => {
  const literal = cask.replaceAll("#{version}", "0.4.0")
  const out = bumpCask(literal, "1.0.0", archives)
  const expected = literal
    .replace('"0.4.0"', '"1.0.0"')
    .replace('"aaaa"', '"8888"')
    .replace(/url "[^"]*"/, `url "${archives[1].url}"`)
  assert.equal(out, expected)
  assert.equal(bumpCask(out, "1.0.0", archives), out)
})

test("cask: a missing file, a second sha256 or other interpolation is refused", () => {
  assert.throws(() => bumpCask(cask, "1.0.0", archives.slice(0, 1)), /no file for the cask's url/)
  const perArch = cask.replace(
    '  sha256 "aaaa"',
    '  sha256 "aaaa"\n  on_intel do\n    sha256 "b"\n  end',
  )
  assert.throws(() => bumpCask(perArch, "1.0.0", archives), /2 'sha256' lines/)
  const arch = cask.replace("macos-aarch64", "macos-#{arch}")
  assert.throws(() => bumpCask(arch, "1.0.0", archives), /more than #\{version\}/)
})

test("formula: no release files is refused", () => {
  assert.throws(() => bumpFormulaFiles(cask, "1.0.0", []), /no release files/)
})

test("cask: a url with #{version} that isn't the release file's is refused", () => {
  const elsewhere = cask.replace("github.com/vladkens", "example.com/vladkens")
  assert.throws(() => bumpCask(elsewhere, "1.0.0", archives), /expected the release file's/)
})

test("homebrew: a version with Ruby syntax is refused", () => {
  assert.throws(() => bumpCask(cask, "1.0.0#{`id`}", archives), /can't go into a formula or cask/)
  assert.throws(() => bumpFormulaFiles(cask, '1"', archives), /can't go into a formula or cask/)
})

test("aur: a single-quoted source with $pkgver is refused", () => {
  const single = pkgbuild.replace(/^source_x86_64=\("(.*)"\)$/m, "source_x86_64=('$1')")
  assert.notEqual(single, pkgbuild)
  assert.throws(() => bumpAur({ pkgbuild: single, srcinfo }, "1.0.0", files), /single-quoted/)
})

test("homebrew: a file name with Ruby syntax is refused", () => {
  const evil = { url: `${release}/Wavo-v1.0.0-#{\`id\`}.dmg`, sha256: "1" }
  const literal = cask.replaceAll("#{version}", "0.4.0")
  assert.throws(() => bumpFormulaFiles(literal, "1.0.0", [evil]), /file name .* can't go into/)
  const quoted = { url: `${release}/Wavo-v1.0.0-macos-aarch64.dmg"`, sha256: "1" }
  assert.throws(() => bumpFormulaFiles(literal, "1.0.0", [quoted]), /file name .* can't go into/)
})
