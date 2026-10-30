# rust-publish

The publishing half of a Rust release: puts [rust-build](../rust-build/)'s files up as the rolling `dev` pre-release, or on a release commit publishes the crate to crates.io and creates the tag and the GitHub release with attestations. It gets the write token and OIDC, never compiles, and runs no project code but the repo's `pack` command.

```yaml
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
    - id: release
      uses: vladkens/actions/rust-publish@v1
```

What it publishes comes from the event and the commit, never from the artifact. On a release the files are renamed from `<name>-dev` to `<name>-vX.Y.Z`; crates.io uses Trusted Publishing, set up with the repo's workflow file. Attestations verify with `gh attestation verify FILE -R <owner>/<repo>`; a private repo gets none.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `files` | `true` | Expect release files from rust-build; `false` for a crate without binaries |
| `crates` | `true` | Publish the crate to crates.io on a release commit |
| `dev` | `true` | Publish the default branch's files as the rolling dev pre-release |
| `name` | repo name | The files' prefix |
| `releasers` | repo owner | Logins allowed to release, separated by spaces or commas; anyone else's release commit fails before anything is published, and one of them re-runs it |
| `artifact` | `release` | The artifact rust-build uploaded |
| `dev-tag` | `dev` | The dev pre-release's tag |
| `dev-branch` | default branch | The branch whose pushes update the dev pre-release |
| `pack` | | A command that makes the release files from rust-build's (see below) |

## Outputs

| Output | What it is |
| --- | --- |
| `tag` | The released tag; empty when this run released nothing |
| `files` | The published files' local paths, one per line |

## pack

`pack` runs in the checkout after the download, with `LABEL` (`dev` or the tag), `TAG` (empty for dev) and the step's `env`, its secrets included. It must not compile. Of the files it leaves at the top of `target/distrib`, only `<name>-dev*`, `update.txt` and, on a release, `<name>-<tag>*` are published (subfolders are skipped; any other file fails the step); the `<name>-dev*` ones are renamed on a release, the others published as they are.

```yaml
    - uses: vladkens/actions/rust-publish@v1
      with:
        pack: make pack
      env:
        SIGN_KEY: ${{ secrets.SIGN_KEY }}
```
