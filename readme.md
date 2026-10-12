# actions

Shared release steps for vladkens' repos: GitHub Actions for the steps that are the same
everywhere, and for Rust repos [rust.yml](#a-rust-repo-rustyml), a reusable workflow that runs the
whole release process with them. A repo keeps its own test jobs and specifics (Docker, Homebrew).

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

## A Rust repo: rust.yml

[rust.yml](.github/workflows/rust.yml) is the whole process above as one reusable workflow; the
repo keeps its own test jobs and calls it after them:

```yaml
jobs:
  test:
    # ...

  release:
    needs: test
    uses: vladkens/actions/.github/workflows/rust.yml@v1
    with:
      dist: make dist # writes target/distrib/<name>-dev*; omit for a crate without binaries
      runner: macos-latest
    permissions:
      attestations: write
      contents: write
      id-token: write
```

- Pushes to the default branch build the archives once (`dist`, read-only) and publish them as
  the `dev` pre-release. A release commit checks the version and notes, publishes the crate and
  creates the release with the same archives renamed from `<name>-dev` to `<name>-vX.Y.Z`.
- Its inputs are in the file. `with:` can't use the `runner` context, so cache paths for
  `cache-directories` are fixed ones like `~/.cache/<dir>`.
- The calling job's `permissions:` are the most its jobs get; the build job narrows them to
  `contents: read`.
- crates.io's Trusted Publishing settings name the caller's workflow file (e.g. `main.yml`), not
  rust.yml: crates.io checks the caller's `workflow_ref`.
- Attestations are signed by rust.yml, so they verify with
  `gh attestation verify FILE -R <owner>/<repo> --signer-repo vladkens/actions`.
- Output `tag` is the released tag, empty otherwise: a repo-specific job (a Homebrew formula,
  say) runs after it with `needs: release` and `if: needs.release.outputs.tag != ''`.
- A tag can't be created by `GITHUB_TOKEN` on a commit whose `.github/workflows` differ from the
  default branch (it has no `workflows` permission): keep workflow edits out of release PRs.

## Development

[agents.md](agents.md) has the rules; `make check` type-checks and runs the unit tests;
[test.yml](.github/workflows/test.yml) runs every action in CI, releases against this repo with
throwaway tags.
