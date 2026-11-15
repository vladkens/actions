import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"

import { env, fail, input, main, required, run, setOutput } from "../lib/core.ts"
import { archiveName, isApple, isShipped, isWindows, parseTargets, profileDir } from "./dist.ts"

type Metadata = {
  target_directory: string
  packages: { name: string; manifest_path: string; targets: { name: string; kind: string[] }[] }[]
}

await main(() => {
  if (input("working-directory")) process.chdir(input("working-directory"))

  const targets = parseTargets(required("targets"))
  const name = input("name") || env("GITHUB_REPOSITORY").split("/")[1]
  const meta = JSON.parse(
    run("cargo", ["metadata", "--no-deps", "--format-version", "1"]),
  ) as Metadata
  const own = realpathSync("Cargo.toml")
  const pkg = meta.packages.find(x => realpathSync(x.manifest_path) === own)
  if (!pkg) fail("Cargo.toml has no [package] to build binaries from")

  const bins = pkg.targets.filter(t => t.kind.includes("bin")).map(t => t.name)
  if (!bins.length) fail(`${pkg.name} has no binary: a library needs no targets`)

  const apple = targets.filter(isApple)
  const other = targets.filter(t => !isApple(t))
  if (apple.length && process.platform !== "darwin")
    fail(`${apple.join(", ")} needs a macOS runner`)
  if (other.length && process.platform === "win32")
    fail(`${other.join(", ")} needs a Linux or macOS runner`)

  // A profile with debug info then leaves `<bin>.dSYM` next to the binary, shipped with it.
  const profile = input("profile") || "release"
  const packed = {
    [`CARGO_PROFILE_${profile.toUpperCase().replace(/-/g, "_")}_SPLIT_DEBUGINFO`]: "packed",
  }
  for (const target of apple) {
    run("rustup", ["target", "add", target])
    run("cargo", ["build", "--profile", profile, "--locked", "--target", target], {
      env: packed,
      stream: true,
    })
  }

  // Linux and Windows from Linux or macOS, without Docker: zig is their C compiler and linker.
  // Both from PyPI, at known versions a few weeks old, not the latest.
  if (other.length) {
    const venv = join(process.env.RUNNER_TEMP || tmpdir(), "rust-dist-zig")
    const bin = join(venv, "bin")
    run("python3", ["-m", "venv", venv])
    run(join(bin, "pip"), [
      "install",
      "--quiet",
      "--disable-pip-version-check",
      "--only-binary",
      ":all:",
      "cargo-zigbuild==0.23.4",
      "ziglang==0.16.0",
    ])
    run("rustup", ["target", "add", ...other])

    // `<target>.2.28` links against glibc 2.28; the build still goes to target/<target>.
    const zigTargets = other.map(t => (t.includes("-linux-gnu") ? `${t}.2.28` : t))
    // The venv's cargo-zigbuild and zig, not others in ~/.cargo/bin or PATH: `cargo zigbuild`
    // would look there first.
    run(
      join(bin, "cargo-zigbuild"),
      ["zigbuild", "--profile", profile, "--locked", ...zigTargets.flatMap(t => ["--target", t])],
      {
        env: {
          // Its zig is `python -m ziglang` with this python first, before any zig on PATH.
          CARGO_ZIGBUILD_PYTHON_PATH: join(bin, "python3"),
          // rust-build caches it
          ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR || join(homedir(), ".cache/zig"),
        },
        stream: true,
      },
    )
  }

  const out = "target/distrib"
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const shipped = readdirSync(".").filter(isShipped).sort()
  const archives = []
  for (const target of targets) {
    const dir = join(meta.target_directory, target, profileDir(profile))
    const files = bins.map(b => (isWindows(target) ? `${b}.exe` : b))
    for (const f of files) if (!existsSync(join(dir, f))) fail(`no ${join(dir, f)} after the build`)

    if (isApple(target))
      files.push(...bins.map(b => `${b}.dSYM`).filter(d => existsSync(join(dir, d))))

    const archive = join(out, archiveName(name, target))
    if (isWindows(target)) {
      run("zip", ["-jq", archive, ...shipped, ...files.map(f => join(dir, f))])
    } else {
      run("tar", ["czhf", archive, ...shipped, "-C", dir, ...files])
    }

    archives.push(archive)
  }

  setOutput("files", archives.join("\n"))
  console.log(
    `${archives.length} archive(s), ${profile} profile, with ${[...bins, ...shipped].join(", ")}:\n${archives.join("\n")}`,
  )
})
