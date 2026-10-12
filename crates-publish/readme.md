# crates-publish

Publishes a crate to crates.io with [Trusted Publishing](https://crates.io/docs/trusted-publishing),
the same exchange as `rust-lang/crates-io-auth-action`, in one step:

1. Reads the package's name and version with `cargo metadata` and stops (output `skipped: true`)
   when that version is already on crates.io, so a re-run never fails on a duplicate.
2. Exchanges the job's OIDC token (audience `crates.io`) for a crates.io token valid 30 minutes.
3. Runs `cargo publish --locked` (plus `--no-verify` with `no-verify: true`) and revokes the token
   right after; a post step revokes it if the job was cancelled in between.

With `dry-run: true` it runs `cargo publish --dry-run --locked` instead and needs no token, so it
fits the read-only check job.

Inputs and outputs: [action.yml](action.yml). Needs a checkout, cargo (preinstalled on the hosted
runners) and `id-token: write`. The crate's Trusted Publishing settings on crates.io name this
repo and the workflow file that runs the step (e.g. `main.yml`); the token names the caller's
workflow, not this action.

```yaml
release:
  needs: [release-check]
  runs-on: ubuntu-latest
  permissions:
    contents: read
    id-token: write
  steps:
    - uses: actions/checkout@v7
    - uses: vladkens/actions/crates-publish@v1
      with:
        no-verify: true # release-check already ran the dry run
```
