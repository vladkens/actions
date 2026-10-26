# release-commit

Tells whether this run releases: `release` is `true` only for a push to the default branch whose commit title is `release: v` and a version, with a squash merge's ` (#N)` after it or not. Any other title, `release: version change` too, and any other event give `false`, and the run builds as a dev commit. rust-build, rust-publish and py-publish decide with it; release-check then checks the version against the manifest.

Inputs and outputs: [action.yml](action.yml). Needs no checkout and no permissions.

```yaml
- id: commit
  uses: vladkens/actions/release-commit@v1
- id: check
  if: steps.commit.outputs.release == 'true'
  uses: vladkens/actions/release-check@v1
```
