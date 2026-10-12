# crates-publish

Publishes a crate to crates.io:

1. Reads the package's name and version with `cargo metadata` and stops (output `skipped: true`)
   when that version is already on crates.io, so a re-run never fails on a duplicate.
2. Runs `cargo publish --locked` (plus `--no-verify` with `no-verify: true`) with `token`.

The token comes from `rust-lang/crates-io-auth-action` in the step before:
[Trusted Publishing](https://crates.io/docs/trusted-publishing) exchanges the job's OIDC token for
a short-lived crates.io token, and that action revokes it at the end of the job. The crate's
settings on crates.io name this repo and the workflow file that runs the step (e.g. `main.yml`).

With `dry-run: true` it runs `cargo publish --dry-run --locked` instead and needs no token, so it
fits the read-only check job.

Inputs and outputs: [action.yml](action.yml). Needs a checkout and cargo (preinstalled on the
hosted runners); the auth action needs `id-token: write`.

```yaml
release:
  needs: [release-check]
  runs-on: ubuntu-latest
  permissions:
    contents: read
    id-token: write
  steps:
    - uses: actions/checkout@v7
    - id: auth
      uses: rust-lang/crates-io-auth-action@v1
    - uses: vladkens/actions/crates-publish@v1
      with:
        token: ${{ steps.auth.outputs.token }}
        no-verify: true # release-check already ran the dry run
```
