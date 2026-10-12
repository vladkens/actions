# actions

Shared release steps for vladkens' repos, as GitHub Actions. A repo's workflow keeps its own jobs
(test, build), `permissions:` and specifics (asset sets, Docker, Homebrew), and calls these for
the steps that are the same everywhere.

| Action | Does |
| --- | --- |
| [release-check](release-check/readme.md) | `release: vX.Y.Z` commit title = manifest version; notes from `changelog.md` |
| [github-release](github-release/readme.md) | Tag, GitHub release, assets; a re-run uploads only what is missing |
| [dev-release](dev-release/readme.md) | Rolling `dev` pre-release with the latest build's assets |
| [crates-publish](crates-publish/readme.md) | `cargo publish`; skips a version already on crates.io |

Use them as `vladkens/actions/<action>@v1`. `v1` moves to each compatible release.

Each action is a Node 24 JavaScript action run from its TypeScript source: no build step and no
dependencies on the runner. They talk to GitHub through `gh`, preinstalled on the hosted Ubuntu
and macOS runners, with the job's `GITHUB_TOKEN` by default. An action can't call another
action, so the repo's workflow keeps the steps that use official ones: `actions/attest` for
attestations and `rust-lang/crates-io-auth-action` for the crates.io token.

## Releasing

1. A `release: vX.Y.Z` PR bumps the version in the manifest and adds the `## vX.Y.Z – date`
   section to `changelog.md`; it is squash-merged, so the commit on `main` is
   `release: vX.Y.Z (#N)`.
2. CI on that push checks it, publishes the package and creates the tag and the GitHub release.
   No one pushes tags by hand.
3. A failed run is fixed by re-running it: every step skips what is already done.

## A Rust repo's workflow

wavo's shape: `dev` builds the archives once (`<name>-dev-<target>.tar.gz`); main pushes publish
them as the `dev` pre-release, and a release commit publishes the same archives renamed to the
version. Builds run without write rights; the jobs that write don't build.

```yaml
name: main

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

# Main runs queue instead, so a dev release is never cut off; a release commit gets its own group.
concurrency:
  group: ${{ github.workflow }}-${{ startsWith(github.event.head_commit.message, 'release:') && github.sha || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: make check test

  dev:
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v7
      - run: make dist # writes target/distrib/wavo-dev-<target>.tar.gz
      - uses: actions/upload-artifact@v7
        with:
          name: dist
          path: target/distrib/*

  dev-release:
    if: github.ref == 'refs/heads/main'
    needs: [test, dev]
    runs-on: ubuntu-latest
    permissions:
      attestations: write
      contents: write
      id-token: write
    concurrency:
      group: dev-release
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: dist
          path: target/distrib
      - id: dev
        uses: vladkens/actions/dev-release@v1
        with:
          files: target/distrib/*
      # Users check an archive with `gh attestation verify FILE -R vladkens/wavo`.
      - if: steps.dev.outputs.skipped == 'false'
        uses: actions/attest@v4
        with:
          subject-path: ${{ steps.dev.outputs.files }}

  release-check:
    if: github.event_name == 'push' && startsWith(github.event.head_commit.message, 'release:')
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.check.outputs.tag }}
      notes: ${{ steps.check.outputs.notes }}
    steps:
      - uses: actions/checkout@v7
      - id: check
        uses: vladkens/actions/release-check@v1
      - uses: vladkens/actions/crates-publish@v1
        with:
          dry-run: true

  release:
    needs: [test, dev, release-check]
    runs-on: ubuntu-latest
    permissions:
      attestations: write
      contents: write
      id-token: write # crates.io Trusted Publishing and attestations
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          name: dist
          path: target/distrib # git-ignored, so cargo publish packs a clean tree
      # https://crates.io/docs/trusted-publishing
      - id: auth
        uses: rust-lang/crates-io-auth-action@v1
      - uses: vladkens/actions/crates-publish@v1
        with:
          token: ${{ steps.auth.outputs.token }}
          no-verify: true
      - id: release
        uses: vladkens/actions/github-release@v1
        with:
          tag: ${{ needs.release-check.outputs.tag }}
          notes: ${{ needs.release-check.outputs.notes }}
          files: target/distrib/*
          rename-from: wavo-dev-
          rename-to: wavo-${{ needs.release-check.outputs.tag }}-
      - uses: actions/attest@v4
        with:
          subject-path: ${{ steps.release.outputs.files }}
```

A repo without binaries drops `dev`, `dev-release`, the download and `files`; a repo that builds
its release archive in the `release` job builds before `github-release` and passes that
file.

## Development

[agents.md](agents.md) has the rules; `make check` type-checks and runs the unit tests;
[test.yml](.github/workflows/test.yml) runs every action in CI, releases against this repo with
throwaway tags.
