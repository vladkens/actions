// The AUR: a package created by hand once, whose PKGBUILD and .SRCINFO a release only bumps.
// makepkg isn't on the runner, so .SRCINFO is edited as text alongside PKGBUILD.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

import { fail } from "../lib/core.ts"
import { clone, commitAndPush, tempPath } from "../lib/git.ts"

// aur.archlinux.org's host keys from ssh-keyscan, each one's SHA256 fingerprint matching the list
// on https://aur.archlinux.org (checked 2026-11-09): Ed25519 RFzBCUItH9LZS0cKB5UE6ceAYhBD5C8GeOBip8Z11+4,
// ECDSA uTa/0PndEgPZTf76e1DFqXKJEXKsn7m9ivhLQtzGOCI, RSA 5s5cIyReIfNNVGRFdDbe3hdYiI5OelHGpw2rOUud3Q8.
const AUR_HOST_KEYS = [
  "aur.archlinux.org ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEuBKrPzbawxA/k2g6NcyV5jmqwJ2s+zpgZGZ7tpLIcN",
  "aur.archlinux.org ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBLMiLrP8pVi5BFX2i3vepSUnpedeiewE5XptnUnau+ZoeUOPkpoCgZZuYfpaIQfhhJJI5qgnjJmr4hyJbe/zxow=",
  "aur.archlinux.org ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKF9vAFWdgm9Bi8uc+tYRBmXASBb5cB5iZsB7LOWWFeBrLp3r14w0/9S2vozjgqY5sJLDPONWoTTaVTbhe3vwO8CBKZTEt1AcWxuXNlRnk9FliR1/eNB9uz/7y1R0+c1Md+P98AJJSJWKN12nqIDIhjl2S1vOUvm7FNY43fU2knIhEbHybhwWeg+0wxpKwcAd/JeL5i92Uv03MYftOToUijd1pqyVFdJvQFhqD4v3M157jxS5FTOBrccAEjT+zYmFyD8WvKUa9vUclRddNllmBJdy4NyLB8SvVZULUPrP3QOlmzemeKracTlVOUG1wsDbxknF1BwSCU7CmU6UFP90kpWIyz66bP0bl67QAvlIc52Yix7pKJPbw85+zykvnfl2mdROsaT8p8R9nwCdFsBc9IiD0NhPEHcyHRwB8fokXTajk2QnGhL+zP5KnkmXnyQYOCUYo3EKMXIlVOVbPDgRYYT/XqvBuzq5S9rrU70KoI/S5lDnFfx/+lPLdtcnnEPk=",
]

type File = { name: string; readonly sha256: string }
export type Package = { pkgbuild: string; srcinfo: string }

// PKGBUILD's top-level `key=value`, unquoted.
const scalar = (text: string, key: string) => {
  const re = new RegExp(`^${key}=(.*)$`, "gm")
  const found = [...text.matchAll(re)]
  if (found.length !== 1) fail(`PKGBUILD has ${found.length} '${key}=' lines; expected one`)
  return { re, value: found[0][1].trim().replace(/^(['"])(.*)\1$/, "$2") }
}

// A PKGBUILD array with one quoted entry, e.g. sha256sums_x86_64=('…').
const array = (text: string, name: string) => {
  const re = new RegExp(`^${name}=\\(([^)]*)\\)`, "gm")
  const found = [...text.matchAll(re)]
  if (found.length !== 1) fail(`PKGBUILD has ${found.length} '${name}=(…)' arrays; expected one`)
  const body = found[0][1]
  const items = [...body.matchAll(/(['"])(.*?)\1/g)]
  if (items.length !== 1 || body.replace(/(['"])(.*?)\1/g, "").trim())
    fail(`PKGBUILD's ${name} is (${body.trim()}); expected one quoted entry`)
  return { re, value: items[0][2], quote: items[0][1] }
}

// A .SRCINFO `key = value` line.
const field = (text: string, key: string) => {
  const re = new RegExp(`^(\\s*${key} = )(.*)$`, "gm")
  const found = [...text.matchAll(re)]
  if (found.length !== 1) fail(`.SRCINFO has ${found.length} '${key} = ' lines; expected one`)
  return { re, value: found[0][2] }
}

// The package at `version` with pkgrel 1 and, for each arch with a `sha256sums_<arch>`, the
// checksum of the release's `*-linux-<arch>.deb`. Sources must use $pkgver, so they need no edit
// in PKGBUILD; in .SRCINFO, which has them expanded, the old version is replaced and the result
// must end in the file's name. A package already at `version` comes back as it is.
export const bumpAur = (pkg: Package, version: string, files: File[]): Package => {
  if (/[\s/:-]/.test(version))
    fail(`version ${version} can't be a pkgver; expected no '-', ':', '/' or spaces`)
  const old = scalar(pkg.pkgbuild, "pkgver").value
  if (old === version) return pkg

  const srcVersion = field(pkg.srcinfo, "pkgver")
  if (srcVersion.value !== old)
    fail(`.SRCINFO's pkgver ${srcVersion.value} differs from PKGBUILD's ${old}; expected the same`)
  const arches = [...pkg.pkgbuild.matchAll(/^sha256sums_(\w+)=/gm)].map(x => x[1])
  if (!arches.length) fail("PKGBUILD has no sha256sums_<arch>=(…) array; expected one per arch")

  let pkgbuild = pkg.pkgbuild
    .replace(/^pkgver=.*$/m, () => `pkgver=${version}`)
    .replace(scalar(pkg.pkgbuild, "pkgrel").re, () => "pkgrel=1")
  let srcinfo = pkg.srcinfo
    .replace(srcVersion.re, (_, key: string) => `${key}${version}`)
    .replace(field(pkg.srcinfo, "pkgrel").re, (_, key: string) => `${key}1`)
  for (const arch of arches) {
    const source = array(pkg.pkgbuild, `source_${arch}`)
    if (!/\$pkgver\b|\$\{pkgver\}/.test(source.value))
      fail(
        `PKGBUILD's source_${arch} ${source.value} has no $pkgver; expected the version as $pkgver`,
      )
    const matches = files.filter(x => x.name.endsWith(`-linux-${arch}.deb`))
    if (matches.length !== 1) {
      const found = matches.map(x => x.name).join(", ") || "none"
      fail(`expected one release file *-linux-${arch}.deb for the AUR, found ${found}`)
    }

    const file = matches[0]
    const url = field(pkg.srcinfo, `source_${arch}`).value.replaceAll(old, version)
    if (!url.endsWith(`/${file.name}`))
      fail(`.SRCINFO's source_${arch} would be ${url}; expected it to end in /${file.name}`)
    const sums = array(pkg.pkgbuild, `sha256sums_${arch}`)
    pkgbuild = pkgbuild.replace(
      sums.re,
      () => `sha256sums_${arch}=(${sums.quote}${file.sha256}${sums.quote})`,
    )
    srcinfo = srcinfo
      .replace(field(pkg.srcinfo, `source_${arch}`).re, (_, key: string) => `${key}${url}`)
      .replace(field(pkg.srcinfo, `sha256sums_${arch}`).re, (_, key: string) => key + file.sha256)
  }

  return { pkgbuild, srcinfo }
}

// Clones the AUR package (a name, or any git URL: a local one in tests) over ssh with the key,
// bumps it and pushes `<package> <version>`; true when it changed. The key goes to a 600 file in a
// 700 temp dir, removed at the end, and reaches ssh only through GIT_SSH_COMMAND's env; ssh trusts
// only AUR_HOST_KEYS. A local URL doesn't use ssh, so the pin doesn't get in its way.
export const publishAur = (pkg: string, key: string, tag: string, files: File[]): boolean => {
  const version = tag.replace(/^v/, "")
  const remote = /^[a-z0-9@._+-]+$/.test(pkg) ? `ssh://aur@aur.archlinux.org/${pkg}.git` : pkg
  const name = basename(pkg, ".git")
  const keyDir = tempPath("aur-ssh")
  mkdirSync(keyDir, { recursive: true, mode: 0o700 })
  try {
    const keyFile = join(keyDir, "key")
    writeFileSync(keyFile, `${key.replace(/\r\n/g, "\n")}\n`, { mode: 0o600 })
    const knownHosts = join(keyDir, "known_hosts")
    writeFileSync(knownHosts, `${AUR_HOST_KEYS.join("\n")}\n`)
    const ssh = [
      `ssh -i '${keyFile}' -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes`,
      `-o UserKnownHostsFile='${knownHosts}'`,
    ]
    const env = { GIT_SSH_COMMAND: ssh.join(" "), GIT_TERMINAL_PROMPT: "0" }
    const dir = tempPath("aur")
    clone(remote, dir, env)

    for (const file of ["PKGBUILD", ".SRCINFO"]) {
      if (!existsSync(join(dir, file)))
        fail(`no ${file} in the AUR package ${name}; expected the package created by hand once`)
    }

    const before = {
      pkgbuild: readFileSync(join(dir, "PKGBUILD"), "utf8"),
      srcinfo: readFileSync(join(dir, ".SRCINFO"), "utf8"),
    }
    const after = bumpAur(before, version, files)
    if (after === before) {
      console.log(`${name} is already at ${version}`)
      return false
    }

    writeFileSync(join(dir, "PKGBUILD"), after.pkgbuild)
    writeFileSync(join(dir, ".SRCINFO"), after.srcinfo)
    commitAndPush(dir, ["PKGBUILD", ".SRCINFO"], `${name} ${version}`, env)
    console.log(`AUR: ${name} → ${version}`)
    return true
  } finally {
    rmSync(keyDir, { recursive: true, force: true })
  }
}
