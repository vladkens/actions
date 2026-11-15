# npm-build

The build half of an npm release: installs with npm or pnpm, runs the `build` script if there is one, packs the package and uploads the tarball as an artifact for [npm-publish](../npm-publish/); on a release PR it first checks it with [release-check](../release-check/). It runs the project's install and build scripts, so its job gets no secrets and no write token: it fails in a job with `id-token: write`.

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v7
    - uses: vladkens/actions/npm-build@v1
```

The lockfile picks the package manager: `pnpm-lock.yaml` installs with pnpm, whose version comes from `packageManager` in package.json, `package-lock.json` with `npm ci`. Packing runs the package's own `prepack` and `prepare` scripts too. It builds on every run, which also checks the packaging, so the job needs no `if:`, and no `permissions:` beyond the workflow's `contents: read`.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `working-directory` | `.` | The directory with `package.json` and its lockfile |
| `node-version` | `24` | The Node.js version to build with |
| `artifact` | `release` | The artifact name npm-publish downloads |

## Outputs

| Output | What it is |
| --- | --- |
| `tarball` | The packed tarball's path |
