# release-check

Checks a release commit and takes its notes from the changelog. Fails with one `::error::` line
when something doesn't match.

- The commit title must be `release: v` + the manifest's version; a trailing ` (#N)` from the
  squash merge is ignored. Only a title starting `release: v` makes a release run; any other,
  `release: ...` without a version included, builds as a dev commit. The manifest is `Cargo.toml`, `pyproject.toml` or `package.json`
  (`[package]` / `[workspace.package]`, `[project]` / `[tool.poetry]`, `version`).
- The notes are the changelog's `## vX.Y.Z ...` section up to the next `## ` heading, without
  `---` rules. The tag is compared as a word: `v1.0.1` never takes `## v1.0.10`. The section must
  have at least one `- ` entry.
- With `releasers` (logins separated by spaces or commas), `actor` must be one of them: by
  default the person who merged the commit, or who re-ran the run. Empty lets anyone release.
- If the tag already exists, it must point to this commit. Checked here, before anything is
  published, and again by `github-release`.

Inputs and outputs: [action.yml](action.yml). Needs a checkout; no permissions beyond
`contents: read`.

```yaml
release-check:
  if: github.event_name == 'push' && startsWith(github.event.head_commit.message, 'release: v')
  runs-on: ubuntu-latest
  outputs:
    tag: ${{ steps.check.outputs.tag }}
    notes: ${{ steps.check.outputs.notes }}
  steps:
    - uses: actions/checkout@v7
    - id: check
      uses: vladkens/actions/release-check@v1
```

The commit message comes from the push event (`github.event.head_commit.message`); pass `message`
to check another one. `notes-file` exists only in this job: pass `notes` to other jobs.
