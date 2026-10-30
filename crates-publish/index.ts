import { realpathSync } from "node:fs"

import { bool, fail, input, main, notice, run, setOutput } from "../lib/core.ts"
import { isPublished } from "./crates.ts"

type Metadata = { packages: { name: string; version: string; manifest_path: string }[] }

await main(async () => {
  const manifest = input("manifest-path")
  const meta = JSON.parse(
    run("cargo", ["metadata", "--no-deps", "--format-version", "1", "--manifest-path", manifest]),
  ) as Metadata
  // `cargo metadata` lists every workspace member: take the named one, else the manifest's own.
  const name = input("package")
  const own = realpathSync(manifest)
  const pkg = name
    ? meta.packages.find(x => x.name === name)
    : meta.packages.find(x => realpathSync(x.manifest_path) === own)
  if (!pkg)
    fail(
      name ? `no package '${name}' in ${manifest}` : `${manifest} has no [package]: set 'package'`,
    )

  if (await isPublished(pkg.name, pkg.version)) {
    notice(`${pkg.name} ${pkg.version} is already on crates.io`)
    setOutput("skipped", "true")
    return
  }
  setOutput("skipped", "false")

  const args = ["publish", "--locked", "--manifest-path", manifest, "--package", pkg.name]
  if (bool("no-verify")) args.push("--no-verify")
  if (bool("dry-run")) {
    run("cargo", [...args, "--dry-run"], { stream: true })
    return
  }
  const token = input("token") || fail("set 'token' (rust-lang/crates-io-auth-action's output)")
  run("cargo", args, { env: { CARGO_REGISTRY_TOKEN: token }, stream: true })
})
