# py-build

The build half of a Python release: builds the sdist and wheel with `uv build` and uploads them as an artifact for [py-publish](../py-publish/); on a release PR it first checks it with [release-check](../release-check/). It runs the project's build backend, so its job gets no secrets and no write token: it fails in a job with `id-token: write`.

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v7
    - uses: vladkens/actions/py-build@v1
```

It builds on every run, which also checks the packaging, so the job needs no `if:`, and no `permissions:` beyond the workflow's `contents: read`.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `working-directory` | `.` | The directory with `pyproject.toml` |
| `artifact` | `release` | The artifact name py-publish downloads |

No outputs.
