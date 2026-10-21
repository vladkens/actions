# py-build and py-publish: PyPI releases from a release commit

twscrape releases on a tag push with its own steps (version check, `uv build`, pypa's publish action, `gh release`). The same split as Rust: a read-only build job and a publish job that never builds, on the `release: vX.Y.Z (#N)` commit.

- [x] `py-build` (composite): refuses a job with id-token, checks a release commit, `uv build` into dist/, uploads the artifact.
- [x] `py-publish` (composite): on a release commit only: release-check, the files must be `<name>-<version>` sdist or wheel, `pypa/gh-action-pypi-publish` with `skip-existing`, then github-release with the changelog notes.
- [x] test.yml: py-build on a package fixture, its files checked; py-publish does nothing outside a release commit; py-build refuses a writing job.
- [x] readme; v1 moved.
- [x] twscrape PR: one `main.yml` (test matrix, build, publish), absolute image URLs in the readme; PyPI's Trusted Publisher on `main.yml`.
- [x] twscrape: `@main` back to `@v1` once v1 is moved.
