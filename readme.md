# actions

Shared release steps for vladkens' repos, as GitHub Actions used like `vladkens/actions/rust-build@v1` (`v1` moves to each compatible release). A repo's `build` job builds and uploads the release files with no secrets and no write token; its `publish` job gets those and never compiles. A release is a squash-merged release PR: CI on that commit tags it and publishes. Test jobs and repo specifics (Docker, store uploads) stay in each repo.

## Actions

| Action | What it does | Trust |
| --- | --- | --- |
| [rust-build](rust-build/) | Checks a release commit or PR, builds the release files and uploads them for rust-publish | Runs the project's build scripts; gets no secrets and no write token |
| [rust-publish](rust-publish/) | Publishes rust-build's files: the rolling dev pre-release, or crates.io, the tag and the GitHub release | Gets the write token and OIDC; never compiles, runs only the repo's `pack` command |
| [py-build](py-build/) | Checks a release PR, builds the sdist and wheel with uv and uploads them for py-publish | Runs the project's build backend; gets no secrets and no write token |
| [py-publish](py-publish/) | On a release commit checks py-build's files and creates the tag and GitHub release for the PyPI upload after it | Gets the write token; never builds or runs project code |
| [homebrew-bump](homebrew-bump/) | Points a tap's formula at the release's archive; does nothing without a release | Gets a token that pushes to the tap; runs no project code |

Each one's readme has its usage, inputs and outputs. The JavaScript actions run on the runner's Node 24 and need `gh` and `git`, preinstalled on GitHub-hosted runners.

## Building blocks

The actions above call these. They are useful on their own, but repos normally use the five above.

| Action | What it does | Trust |
| --- | --- | --- |
| [release-commit](release-commit/) | Tells whether this run releases: a push of a `release: vX.Y.Z` commit to the default branch | Reads only the event; no token |
| [release-check](release-check/) | Checks a release commit's or PR's title against the manifest version, the `changelog.md` section, the plans, the tag and who releases | Reads the checkout and the repo's tags; no secrets |
| [github-release](github-release/) | Tags the commit and creates its GitHub release; a re-run uploads only missing assets, or replaces a leftover draft's | Needs `contents: write`; runs no project code |
| [dev-release](dev-release/) | Points the rolling `dev` pre-release at this commit and replaces its assets | Needs `contents: write`; runs no project code |
| [crates-publish](crates-publish/) | Runs `cargo publish`, or its dry run; skips a version already on crates.io | Gets the crates.io token; compiles the crate unless `no-verify` |
| [dev-version](dev-version/) | Sets a non-release build's version in Cargo.toml and Cargo.lock to `git describe`'s (`0.9.0-12-g3672a1b`) | Edits only the checkout; no secrets, runs no project code |
| [rust-dist](rust-dist/) | Builds a crate's binaries for a list of targets and packs each with the readme and license | Runs the project's build scripts; needs no token |

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

# A running main run (and its dev release) is never cut off, but a newer push replaces a still-pending one; a release commit gets its own group, so it is never replaced; PR runs cancel each other.
concurrency:
  group: ${{ github.workflow }}-${{ startsWith(github.event.head_commit.message, 'release:') && github.sha || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  test:
    # ...

  # No secrets, no write token: dependencies' build scripts run here. Also on release PRs, which it checks.
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

- A release publishes the crate and the files renamed from `<name>-dev` to `<name>-vX.Y.Z`; the targets, the dev pre-release, crates.io and `pack` (the final release files, made in `publish`) are inputs of [rust-build](rust-build/) and [rust-publish](rust-publish/).
- A Homebrew formula follows a release with [homebrew-bump](homebrew-bump/) as one more step in `publish`.

## A Python repo

```yaml
# The same `on:` as the Rust example.
permissions:
  contents: read

jobs:
  test:
    # ...

  # No secrets, no write token: the build backend runs here. Runs on every PR, so it checks release PRs.
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

There is no dev pre-release for Python; a failed PyPI upload is fixed by re-running the job.

## Rules

- Permissions: `build` runs the project's build code, so it gets no `permissions:` beyond the top-level `contents: read` (rust-build fails in a job with `id-token: write`); every write permission goes to `publish`, which never compiles.
- Secrets: crates.io and PyPI publish through Trusted Publishing, set up with the repo's workflow file (e.g. `main.yml`) and, on PyPI, no environment or the one `publish` uses; GitHub calls use the job's `GITHUB_TOKEN`; other secrets (a signing key, the tap token) go in the step's `env` or inputs.
- Release flow: a `release: vX.Y.Z` PR bumps the manifest version and adds a `## vX.Y.Z – date` section to `changelog.md`; `build` checks it with [release-check](release-check/) and builds the release files. A PR renamed to `release: …` later reruns only with `edited` in `on.pull_request.types`.
- The PR is squash-merged, so `main` gets `release: vX.Y.Z (#N)`, and CI on that push publishes the package and creates the tag and the GitHub release; no one pushes tags by hand.
- rust-publish and py-publish decide what to publish from the event and the commit, never from the artifact, and accept only the expected file names.
- release-check blocks a release on a finished plan left outside `docs/plans/completed/` or a completed one without `Done:` and `## Result`, and on a PR also on an existing tag.
- Only `releasers` (the repo owner by default) release: a release commit merged by anyone else fails before anything is published, and the owner re-runs it.
- A failed run is fixed by re-running it: every step skips what is already done.
- Keep workflow edits out of release PRs: `GITHUB_TOKEN` can't tag a commit whose `.github/workflows` differs from the default branch.

## Contributing

Pull requests are welcome, including ones made with agents: point yours at [agents.md](agents.md).
