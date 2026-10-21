# actions

Shared release steps for vladkens' repos, as GitHub Actions. A Rust repo uses two of them:
[rust-build](#a-rust-repo) and [rust-publish](#a-rust-repo) hide the whole release process, and a
Python repo [py-build and py-publish](#a-python-repo); the others are their building blocks,
usable on their own. A repo keeps its own test jobs and
specifics (Docker, Homebrew).

| Action | Does |
| --- | --- |
| rust-build | Read-only: checks a release commit, builds the release files, uploads them |
| rust-dist | Builds a crate's binaries for a list of targets and packs them with the readme and license |
| rust-publish | Writes, never compiles: the dev pre-release, or crates.io + tag + GitHub release |
| py-build | Read-only: checks a release commit, builds the sdist and wheel with uv, uploads them |
| py-publish | Writes, never builds: on a release commit checks the files, tag + GitHub release |
| [release-check](release-check/readme.md) | `release: vX.Y.Z` commit title = manifest version; notes from `changelog.md` |
| [github-release](github-release/readme.md) | Tag, GitHub release, assets; a re-run uploads only what is missing |
| [dev-release](dev-release/readme.md) | Rolling `dev` pre-release with the latest build's assets |
| [crates-publish](crates-publish/readme.md) | `cargo publish`; skips a version already on crates.io |
| dev-version | Non-release builds report `git describe`'s version (e.g. `0.9.0-12-g3672a1b`) |
| homebrew-bump | Points a tap's formula at the release's archive; nothing without a release |

Use them as `vladkens/actions/<action>@v1`. `v1` moves to each compatible release.

The building blocks are Node 24 JavaScript actions run from their TypeScript source: no build step
and no dependencies on the runner. They talk to GitHub through `gh`, preinstalled on the hosted
Ubuntu and macOS runners, with the job's `GITHUB_TOKEN` by default. rust-build and rust-publish
are composite actions that chain them with the official `actions/attest` and
`rust-lang/crates-io-auth-action`, calling this repo's actions through `$/` so all run at the same
commit.

## Releasing

1. A `release: vX.Y.Z` PR bumps the version in the manifest and adds the `## vX.Y.Z – date`
   section to `changelog.md`; it is squash-merged, so the commit on `main` is
   `release: vX.Y.Z (#N)`.
2. CI on that push checks it, publishes the package and creates the tag and the GitHub release.
   No one pushes tags by hand.
3. A failed run is fixed by re-running it: every step skips what is already done.

## A Rust repo

```yaml
jobs:
  test:
    # ...

  # Read-only: dependencies' build scripts run here, so no `permissions:` beyond the top-level
  # `contents: read`. Beside `test`, on the default branch only.
  build:
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v7
      - uses: vladkens/actions/rust-build@v1
        with:
          targets: aarch64-apple-darwin x86_64-unknown-linux-gnu x86_64-pc-windows-gnu

  # Writes, never compiles.
  publish:
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

- A release commit publishes the crate and creates the release with its files renamed from
  `<name>-dev` to `<name>-vX.Y.Z` (`<name>` is the repo's name unless set). With `dev: true` on
  rust-build, every push to the default branch also builds them and rust-publish puts them up
  as the rolling `dev` pre-release (for testing fixes, or a baseline to compare against); off
  by default, so other pushes build nothing.
- Outside release commits rust-build first sets the package version in Cargo.toml and Cargo.lock
  to `git describe` against the last `vX.Y.Z` tag (`0.9.0-12-g3672a1b`: 12 commits after
  v0.9.0), so dev builds say what they are; a release builds its plain version.
  `dev-version: false` turns it off.
- rust-publish decides what to publish from the event and the commit, never from the artifact,
  and refuses files not named `<name>-dev*`. It does nothing on pull requests or other branches.
- rust-build fails in a job with `id-token: write`; it can't see `contents: write`, so keep every
  write permission to the publish job.
- `targets` builds the binaries (Apple ones on the Mac, Linux and Windows through
  [cargo-cross](https://github.com/zijiren233/cargo-cross), glibc 2.28) into
  `<name>-dev-<target>.tar.gz` (`.zip` for Windows) with the readme and license; no Makefile target
  needed. `profile: dist` builds another cargo profile; with debug info the macOS archives also
  get `<bin>.dSYM`. `dist: <command>` replaces it all when a repo ships something else.
- Inputs: `rust-build/action.yml`, `rust-publish/action.yml`. A crate without binaries drops
  `targets` and sets `files: false` on rust-publish; `crates: false` skips crates.io. Output `tag` is the released tag, empty otherwise, for steps after it (a
  Homebrew formula, say).
- Keep the workflow's `concurrency` queueing default-branch runs (not cancelling them), so two
  dev updates don't overlap.
- A Homebrew formula follows a release with one more step in `publish`, after
  `- id: release` `uses: vladkens/actions/rust-publish@v1`:

  ```yaml
      - uses: vladkens/actions/homebrew-bump@v1
        with:
          tag: ${{ steps.release.outputs.tag }} # empty unless released: then it does nothing
          file: ${{ steps.release.outputs.files }} # the one archive the formula downloads
          tap: vladkens/homebrew-tap
          token: ${{ secrets.HOMEBREW_REPO_TOKEN }} # can push to the tap
  ```

  It sets the formula's (`<repo>.rb`, or `formula`) `url`, `sha256` and `version` from the
  published archive and pushes as github-actions[bot]; formulas with one download only.
- crates.io's Trusted Publishing settings name the repo's workflow file (e.g. `main.yml`), and
  attestations verify with `gh attestation verify FILE -R <owner>/<repo>`. A private repo gets no
  attestations: GitHub offers them there only on Enterprise Cloud.
- `GITHUB_TOKEN` can't create a tag on a commit whose `.github/workflows` differ from the default
  branch (it has no `workflows` permission): keep workflow edits out of release PRs.

## A Python repo

```yaml
jobs:
  test:
    # ...

  # Read-only: the build backend runs here.
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

- Every run builds the files (cheap, and it checks the packaging). On a release commit py-publish
  downloads them into `dist/`, creates the tag and the GitHub release with the changelog's notes,
  and [pypa/gh-action-pypi-publish](https://github.com/pypa/gh-action-pypi-publish) uploads them
  to PyPI through Trusted Publishing, with PEP 740 attestations. A failed upload is fixed by
  re-running the job. No dev pre-release.
- py-publish refuses files other than `<name>-<version>.tar.gz` and `<name>-<version>-*.whl`
  (the normalized project name and the release's version, which must be canonical PEP 440).
- PyPI's Trusted Publisher names the repo's workflow file (e.g. `main.yml`), with no environment.
- The readme becomes the PyPI page: link images by absolute URL.
- Inputs: `py-build/action.yml`, `py-publish/action.yml`.

## Development

[agents.md](agents.md) has the rules; `make check` type-checks and runs the unit tests;
[test.yml](.github/workflows/test.yml) runs every action in CI, releases against this repo with
throwaway tags.
