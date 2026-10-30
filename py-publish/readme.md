# py-publish

The publishing half of a Python release: on a release commit it checks [py-build](../py-build/)'s files into `dist/` and creates the tag and the GitHub release with the changelog's notes; the workflow's next step uploads them to PyPI. It gets the write token and never builds or runs project code.

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
    - id: release
      uses: vladkens/actions/py-publish@v1
    # Here, not inside py-publish: it can't run from a composite action.
    - if: steps.release.outputs.tag != ''
      uses: pypa/gh-action-pypi-publish@release/v1
      with:
        skip-existing: true
```

What it publishes comes from the event and the commit, never from the artifact. It accepts only `<name>-<version>.tar.gz` and `<name>-<version>-*.whl`, so the version in `pyproject.toml` must be canonical PEP 440. PyPI's Trusted Publisher names the repo's workflow file and no environment, or the one `publish` uses. There is no dev pre-release, and a failed upload is fixed by re-running the job.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `working-directory` | `.` | The directory with `pyproject.toml` and `changelog.md` |
| `releasers` | repo owner | Logins allowed to release, separated by spaces or commas; anyone else's release commit fails before anything is published, and one of them re-runs it |
| `artifact` | `release` | The artifact py-build uploaded |

## Outputs

| Output | What it is |
| --- | --- |
| `tag` | The released tag; empty when this run released nothing, so the PyPI upload after it is skipped |
