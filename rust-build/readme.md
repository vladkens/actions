# rust-build

The build half of a Rust release: checks a release commit or PR, builds the release files and uploads them as an artifact for [rust-publish](../rust-publish/). It runs the project's build scripts, so its job gets no secrets and no write token: it fails in a job with `id-token: write`.

```yaml
build:
  if: "github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch' || startsWith(github.event.pull_request.title, 'release: v')"
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v7
    - uses: vladkens/actions/rust-build@v1
      with:
        targets: aarch64-apple-darwin x86_64-unknown-linux-gnu x86_64-pc-windows-gnu
```

The job needs no `permissions:` beyond the workflow's `contents: read`. Its `if:` also runs it on release PRs, which it checks with [release-check](../release-check/) and `cargo publish --dry-run` before building the files with the plain version, as the release will.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `targets` | | Rust targets to build, each packed with the readme and license as `<name>-dev-<target>.tar.gz` (`.zip` for Windows); empty for a crate without binaries |
| `name` | repo name | The archives' prefix |
| `profile` | `release` | The cargo profile `targets` builds; with debug info Apple targets also ship `<bin>.dSYM` |
| `dist` | | Instead of `targets`, a command that builds the release files into `target/distrib` as `<name>-dev*` |
| `dev` | `false` | Also build on other pushes, for rust-publish's rolling `dev` pre-release |
| `crates` | `true` | Run `cargo publish --dry-run` on a release commit or PR |
| `dev-version` | `true` | Outside releases, build with `git describe`'s version (`0.9.0-12-g3672a1b`) |
| `cache` | `true` | Cache cargo's registry and `target/` with Swatinem/rust-cache |
| `cache-directories` | | More directories for that cache, one per line |
| `artifact` | `release` | The artifact name rust-publish downloads |

No outputs. Release commits, release PRs and manual runs always build the files; other pushes only with `dev: true`. Apple targets need a macOS runner; Linux and Windows ones build through [cargo-cross](https://github.com/zijiren233/cargo-cross) (glibc 2.28).
