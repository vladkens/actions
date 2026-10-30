import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { env, fail, input, main, probe, required, run, setOutput } from "../lib/core.ts"
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

  // Linux and Windows from any host, without Docker: https://github.com/zijiren233/cargo-cross
  if (other.length) {
    if (probe("cargo", ["cross", "--version"]) === null) {
      run("cargo", ["install", "--locked", "cargo-cross@1.6.0"], { stream: true })
    }

    run(
      "cargo",
      [
        "cross",
        "build",
        "--profile",
        profile,
        "--locked",
        "--glibc-version",
        "2.28",
        "--targets",
        other.join(","),
      ],
      {
        env: {
          CROSS_COMPILER_DIR:
            process.env.CROSS_COMPILER_DIR || join(homedir(), ".cache/cargo-cross"),
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
