# github-release

Tags the workflow's commit and creates its GitHub release with assets. Every step is safe to
re-run:

- The tag: fails if it already points to another commit; creates it (lightweight, at
  `GITHUB_SHA`) when missing.
- The release: created with the title (the tag by default), the notes and the assets. When it
  already exists, only missing assets are uploaded; the notes and the assets already there stay.
  Those are downloaded over the local files, so `files` and the steps after it (attestation,
  checksums, a Homebrew formula) see the published bytes, not a rebuild's.
- `rename-from` / `rename-to` rename the assets first, e.g. a `dev` build's `wavo-dev-*` archives
  to `wavo-v1.2.3-*`.

Inputs and outputs: [action.yml](action.yml). Needs `contents: write`; no checkout. Attest the
assets in the next step: an action can't call `actions/attest` itself.

```yaml
release:
  needs: [release-check]
  runs-on: ubuntu-latest
  permissions:
    attestations: write
    contents: write
    id-token: write # attestations
  steps:
    - uses: actions/download-artifact@v8
      with:
        name: dist
        path: dist
    - id: release
      uses: vladkens/actions/github-release@v1
      with:
        tag: ${{ needs.release-check.outputs.tag }}
        notes: ${{ needs.release-check.outputs.notes }}
        files: dist/*
        rename-from: wavo-dev-
        rename-to: wavo-${{ needs.release-check.outputs.tag }}-
    - uses: actions/attest@v4
      with:
        subject-path: ${{ steps.release.outputs.files }}
```
