# dev-release

Keeps a rolling pre-release (`dev` by default) at the latest build of a branch:

- Skips (output `skipped: true`) when the branch has moved past this commit, so an older build
  never replaces a newer one.
- Moves the tag to `GITHUB_SHA`, creates the pre-release or uploads the assets over the old ones,
  deletes old assets not in `files`, and updates the title and notes (by default the branch,
  commit and build time).

Inputs and outputs: [action.yml](action.yml). Needs `contents: write`; no checkout. Give the job a
`concurrency` group so two builds don't update the release at once, and keep the build in another
job without write rights.

```yaml
dev-release:
  if: github.ref == 'refs/heads/main'
  needs: [test, dev]
  runs-on: ubuntu-latest
  permissions:
    attestations: write
    contents: write
    id-token: write # attestations
  concurrency:
    group: dev-release
  steps:
    - uses: actions/download-artifact@v8
      with:
        name: dist
        path: dist
    - id: dev
      uses: vladkens/actions/dev-release@v1
      with:
        files: dist/*
    - if: steps.dev.outputs.skipped == 'false'
      uses: actions/attest@v4
      with:
        subject-path: ${{ steps.dev.outputs.files }}
```
