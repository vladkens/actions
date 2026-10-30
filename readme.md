# actions

Shared release steps for vladkens' repos, as GitHub Actions used like `vladkens/actions/rust-build@v1` (`v1` moves to each compatible release). A repo's `build` job is read-only and uploads the release files; its `publish` job writes and never compiles. A release is a squash-merged release PR: CI on that commit tags it and publishes. Test jobs and repo specifics (Docker, store uploads) stay in each repo.

## Actions

| Action | Does |
| --- | --- |
| rust-build | Read-only: checks a release commit or PR, builds the release files, uploads them |
| rust-publish | Writes, never compiles: the dev pre-release, or crates.io + tag + GitHub release |
| py-build | Read-only: checks a release PR, builds the sdist and wheel with uv, uploads them |
| py-publish | Writes, never builds: on a release commit checks the files, tag + GitHub release |
| homebrew-bump | Points a tap's formula at the release's archive; nothing without a release |

Inputs and outputs are in each action's `action.yml`. The JavaScript actions run on the runner's Node 24 and need `gh` and `git`, preinstalled on GitHub-hosted runners.

## Building blocks

The actions above call these. They are useful on their own, but repos normally use the five above.

| Action | Does |
| --- | --- |
| [release-commit](release-commit/readme.md) | Is this run a release: a push of a `release: vX.Y.Z` commit to the default branch |
| [release-check](release-check/readme.md) | A release commit's or PR's title matches the manifest version, `changelog.md` has its section, plans are filed, the tag is free |
| [github-release](github-release/readme.md) | Tag, GitHub release and assets; a re-run uploads only what is missing, or replaces a leftover draft's |
| [dev-release](dev-release/readme.md) | Rolling `dev` pre-release with the latest build's assets |
| [crates-publish](crates-publish/readme.md) | `cargo publish`; skips a version already on crates.io |
| dev-version | Non-release builds report `git describe`'s version (e.g. `0.9.0-12-g3672a1b`) |
| rust-dist | Builds a crate's binaries for a list of targets and packs them with the readme and license |

## A Rust repo

```yaml
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, edited] # edited: a PR renamed to `release: v…`
  workflow_dispatch:

permissions:
  contents: read

# Main runs queue, so a dev release is never cut off; a release commit gets its own group.
concurrency:
  group: ${{ github.workflow }}-${{ startsWith(github.event.head_commit.message, 'release:') && github.sha || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  test:
    # ...

  # Read-only: dependencies' build scripts run here. Also on release PRs, which it checks.
  build:
    if: "github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch' || startsWith(github.event.pull_request.title, 'release: v')"
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v7
      - uses: vladkens/actions/rust-build@v1
        with:
          targets: aarch64-apple-darwin x86_64-unknown-linux-gnu x86_64-pc-windows-gnu

  # Writes, never compiles.
  publish:
    if: github.ref == 'refs/heads/main'
    needs: [test, build]
    runs-on: ubuntu-latest
    permissions:
      attestations: write
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - uses: vladkens/actions/rust-publish@v1
```

- A release publishes the crate and the files renamed from `<name>-dev` to `<name>-vX.Y.Z`; a crate without binaries drops `targets` and sets `files: false` on rust-publish.
- `crates: false` on both actions skips crates.io, for a crate with `publish = false` or one not meant for it.
- `targets` builds Apple targets on the Mac and Linux and Windows ones through [cargo-cross](https://github.com/zijiren233/cargo-cross) (glibc 2.28); `dist: <command>` replaces it when a repo ships something else.
- Outside release commits and release PRs rust-build sets the package version to what `git describe` gives (`0.9.0-12-g3672a1b`), so dev builds say what they are; `dev-version: false` turns it off.
- With `dev: true` on rust-build, every push to `main` also builds the files and rust-publish updates the rolling `dev` pre-release; keep the workflow's `concurrency` queueing `main` runs, not cancelling them.
- Attestations verify with `gh attestation verify FILE -R <owner>/<repo>`; a private repo gets none.
- `pack: <command>` on rust-publish makes the final release files from rust-build's (an app bundle and disk image, installers, an update feed), with `LABEL` (`dev` or the tag), `TAG` (empty for dev) and the step's `env`, its secrets included; a macOS app is signed and notarized there. It must not compile, and of the files it leaves at the top of `target/distrib` only `<name>-dev*`, `update.txt` and, on a release, `<name>-<tag>*` are published (subfolders are skipped; any other file fails the step).

  ```yaml
      - uses: vladkens/actions/rust-publish@v1
        with:
          pack: make pack
        env:
          SIGN_KEY: ${{ secrets.SIGN_KEY }}
  ```

- A Homebrew formula with one download follows a release with one more step in `publish`, after `- id: release` `uses: vladkens/actions/rust-publish@v1`; it gets one archive, since `files` lists them all:

  ```yaml
      - uses: vladkens/actions/homebrew-bump@v1
        with:
          tag: ${{ steps.release.outputs.tag }} # empty unless released: then it does nothing
          file: target/distrib/<name>-${{ steps.release.outputs.tag }}-aarch64-apple-darwin.tar.gz
          tap: vladkens/homebrew-tap
          token: ${{ secrets.HOMEBREW_REPO_TOKEN }} # can push to the tap
  ```

## A Python repo

```yaml
# The same `on:` as the Rust example.
permissions:
  contents: read

jobs:
  test:
    # ...

  # Read-only: the build backend runs here. Runs on every PR, so it checks release PRs.
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: vladkens/actions/py-build@v1

  # Writes, never builds.
  publish:
    if: github.ref == 'refs/heads/main'
    needs: [test, build]
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - id: release
        uses: vladkens/actions/py-publish@v1
      # Here, not inside py-publish: it can't run from a composite action.
      - if: steps.release.outputs.tag != ''
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          skip-existing: true
```

There is no dev pre-release for Python; a failed PyPI upload is fixed by re-running the job. py-publish accepts only `<name>-<version>.tar.gz` and `<name>-<version>-*.whl`, so the version in `pyproject.toml` must be canonical PEP 440.

## Rules

- Permissions: `build` runs the project's build code, so it gets no `permissions:` beyond the top-level `contents: read` (rust-build fails in a job with `id-token: write`); every write permission goes to `publish`, which never compiles.
- Secrets: crates.io and PyPI publish through Trusted Publishing, set up with the repo's workflow file (e.g. `main.yml`) and, on PyPI, no environment or the one `publish` uses; GitHub calls use the job's `GITHUB_TOKEN`; other secrets (a signing key, the tap token) go in the step's `env` or inputs.
- Release flow: a `release: vX.Y.Z` PR bumps the manifest version and adds a `## vX.Y.Z – date` section to `changelog.md`; `build` checks it with [release-check](release-check/readme.md) and builds the release files. A PR renamed to `release: …` later reruns only with `edited` in `on.pull_request.types`.
- The PR is squash-merged, so `main` gets `release: vX.Y.Z (#N)`, and CI on that push publishes the package and creates the tag and the GitHub release; no one pushes tags by hand.
- rust-publish and py-publish decide what to publish from the event and the commit, never from the artifact, and accept only the expected file names.
- release-check blocks a release on a finished plan left outside `docs/plans/completed/` or a completed one without `Done:` and `## Result`, and on a PR also on an existing tag.
- Only `releasers` (the repo owner by default) release: a release commit merged by anyone else fails before anything is published, and the owner re-runs it.
- A failed run is fixed by re-running it: every step skips what is already done.
- Keep workflow edits out of release PRs: `GITHUB_TOKEN` can't tag a commit whose `.github/workflows` differs from the default branch.

## Tools

[tools.yml](.github/workflows/tools.yml), run by hand (`gh workflow run tools.yml`), releases static Linux `dmg` and `hfsplus` binaries from [mozilla/libdmg-hfsplus](https://github.com/mozilla/libdmg-hfsplus) as `tools-<yyyymmdd>`, for making macOS disk images on Linux. Each release ships a `SHA256SUMS` that users pin, and a day's release is never rebuilt.

## Contributing

Pull requests are welcome, including ones made with agents: point yours at [agents.md](agents.md).
