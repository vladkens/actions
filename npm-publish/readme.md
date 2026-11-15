# npm-publish

The publishing half of an npm release: on a release commit it checks [npm-build](../npm-build/)'s tarball, creates the tag and the GitHub release with the changelog's notes and publishes the tarball to npm. It gets the write token and OIDC, and never builds or runs project code.

```yaml
publish:
  if: github.ref == 'refs/heads/main'
  needs: [test, build]
  runs-on: ubuntu-latest
  permissions:
    contents: write
    id-token: write
  steps:
    - uses: actions/checkout@v7
    - uses: vladkens/actions/npm-publish@v1
```

What it publishes comes from the event and the commit, never from the artifact. It accepts only `<name>-<version>.tgz` (`@scope/name` packs as `scope-name-<version>.tgz`) whose `package.json` has the checkout's name and version, and publishes it with `npm publish --ignore-scripts`, outside the checkout. npm authenticates through Trusted Publishing, which also attaches the provenance attestation: the package's Trusted Publisher on npmjs.com names the repo and its workflow file, with no environment, or the one `publish` uses; no npm token. A version already on npm is skipped, so a failed run is fixed by re-running it. There is no dev pre-release.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `working-directory` | `.` | The directory with `package.json` and `changelog.md` |
| `releasers` | repo owner | Logins allowed to release, separated by spaces or commas; anyone else's release commit fails before anything is published, and one of them re-runs it |
| `artifact` | `release` | The artifact npm-build uploaded |

## Outputs

| Output | What it is |
| --- | --- |
| `tag` | The released tag; empty when this run released nothing |
