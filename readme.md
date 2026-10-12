# actions

Shared release steps for vladkens' repos, as GitHub Actions. A repo's workflow keeps its own jobs
(test, build), `permissions:` and specifics (asset sets, Docker, Homebrew), and calls these for
the steps that are the same everywhere.

| Action | Does |
| --- | --- |
| [release-check](release-check/readme.md) | `release: vX.Y.Z` commit title = manifest version; notes from `changelog.md` |
| [github-release](github-release/readme.md) | Tag, GitHub release, assets; a re-run uploads only what is missing |
| [dev-release](dev-release/readme.md) | Rolling `dev` pre-release with the latest build's assets |
| [crates-publish](crates-publish/readme.md) | crates.io Trusted Publishing; skips a version already published |

Use them as `vladkens/actions/<action>@v1`. `v1` moves to each compatible release.

Each action is a Node 24 JavaScript action run from its TypeScript source: no build step and no
dependencies on the runner. They talk to GitHub through `gh`, preinstalled on the hosted Ubuntu
and macOS runners, with the job's `GITHUB_TOKEN` by default. Attestation stays an
`actions/attest` step in the repo's workflow, since an action can't call another action.

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
      - uses: vladkens/actions/crates-publish@v1
        with:
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
its release archive in the `release` job (macmon) builds before `github-release` and passes that
file.

## Migrating a repo

One PR in the repo, following its own `agents.md`.

- Replace with the actions: the commit title check, the changelog `awk`, the crates.io check +
  `crates-io-auth-action` + `cargo publish`, the tag check and push, `gh release create/upload`,
  the `dev` tag move and `gh release` calls.
- Keep in the repo: test and build jobs, caches, toolchains, archive names, a binary's `-V` check
  against `${TAG#v}`, `actions/attest`, Homebrew, `permissions:` per job, `concurrency`.
- Pass untrusted values to scripts only through `env:` (e.g. `TAG: ${{ needs.release-check.outputs.tag }}`),
  never `${{ … }}` inside `run:`.
- crates.io's Trusted Publishing settings name the repo and the workflow file (`main.yml`); they
  stay valid while the publish step stays in that file. If the settings name an environment, the
  publishing job needs `environment:` with that name.
- `github-release` needs `notes`: `${{ steps.check.outputs.notes }}` in the job that ran
  `release-check`, else `${{ needs.<job>.outputs.notes }}` exported from it (`notes-file` is a
  path on that job's runner only).
- `release-check` already refuses a tag on another commit, so it runs before `crates-publish`.
- Prove it on a `dev` build (main push) and on the next real release.

Bugs the old copies had, now fixed by the actions:

- The notes `awk "/^## ${VERSION}/…"` built a regex from the tag: `v1.0.1` also matched `v1.0.10`,
  and `.` matched any character.
- An exact title check failed on the squash merge's ` (#N)` (macmon, delta-farmer).
- Tag-push workflows failed on a re-run: duplicate crate, duplicate release.
- `${{ github.ref_name }}` interpolated into `run:` (script injection).
- unjar's hardcoded `if: github.ref_name != 'v0.1.0'` to skip a version already published.
- unjar and badgelib accepted any non-empty notes; the actions require a `- ` entry.

### wavo

Its workflow is the example above: `release-check`'s steps, the `release` job's tag check, rename,
crates.io and release steps, and `dev-release`'s shell script become the actions. Same archive
names, same artifact (`wavo-dev` there), same attestation.

### macmon

- `dev`: builds and writes in one job; split it like the example (build + upload artifact, then a
  write job with `dev-release`), or call `dev-release` in place with `files: macmon-dev.tar.gz`.
  Optionally attest, as wavo does.
- `release`: `release-check` as its first step (or a job); then the build and `macmon -V` check
  with `TAG` from its output; `crates-publish` (without `no-verify`, nothing ran the dry run);
  `github-release` with `notes: ${{ steps.check.outputs.notes }}` and
  `files: macmon-${{ steps.check.outputs.tag }}.tar.gz`.
- The Homebrew bump hashes `steps.release.outputs.files` (the published archive, also on a
  re-run, which the old `gh release download` did by hand). It runs on macOS, so its BSD
  `sed -i ''` works; on Linux it would need `sed -i`.

### unjar

- Moves from tag pushes to the `release:` commit: drop `tags: ["v*"]` from `on.push`, gate the
  release jobs on the commit title, and replace `github.ref_name` with `release-check`'s `tag`.
- `publish`: `release-check`, the `-V` check, `crates-publish`; drop the `v0.1.0` exception.
  Export `tag` and `notes` as job outputs.
- `release` (macOS, builds the aarch64 binary): archive
  `unjar-${TAG}-aarch64-apple-darwin.tar.gz`, `github-release` with it and
  `notes: ${{ needs.publish.outputs.notes }}`, `actions/attest` on `files`.

### badgelib

- Moves from tag pushes to the `release:` commit, as unjar.
- `publish` + `release` become one job: `release-check`, `crates-publish`, `github-release`
  with `notes: ${{ steps.check.outputs.notes }}` and no `files`.

## Development

[agents.md](agents.md) has the rules; `make check` type-checks and runs the unit tests;
[test.yml](.github/workflows/test.yml) runs every action in CI, releases against this repo with
throwaway tags.
