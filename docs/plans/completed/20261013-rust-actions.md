# rust-build and rust-publish: a Rust repo's release in two actions

Done: 2026-10-14, PR #1

The four building blocks leave ~70 lines of wiring per repo. A reusable workflow (rust.yml) hid
it, but looked noisy (nested skipped jobs, the `.github/workflows` path, `--signer-repo` for
attestations). Two composite actions hide the same plumbing and keep the split: rust-build in a
read-only job (build scripts run there), rust-publish in a write job that never compiles. The
wavo session and three independent reviews (security, DX, mechanics) chose this.

Checked from primary sources: composite actions call sibling actions at the same commit with
`$/`; crates.io and attestations see the caller's own workflow; crates-io-auth-action's post step
(token revocation) runs inside a composite; a publish-only re-run still finds the artifact.

- [x] rust-build: read-only self-check, release-check + crates dry run on release commits,
      `dist`, upload artifact.
- [x] rust-publish: mode from the event (release / dev / none), files checked against
      `<name>-dev*`, crates.io, github-release, dev-release, attestations; `files`, `crates`,
      `dev` switches; outputs `tag`, `files`.
- [x] test.yml: build → publish dev path under a throwaway tag, `gh attestation verify -R` with
      no signer flags, the write-job refusal and the file-name check.
- [x] Green on the branch, then wavo's PR #40 on them and its comments.
- [x] The release path proven by wavo's first release through them.
- Later, when a repo needs them: build matrices (lalo), Homebrew, macOS signing.

## Result

On `v1` (86721ed, which also skips attestations in private repos). wavo's main.yml went from 220
to 90 lines (wavo#40). Proven on wavo: dev runs (pre-release with 4 archives, attestation
verified with plain `-R`; an older run correctly skipped once main had moved on) and the 0.3.0
release (run 38506051491: crates.io, tag, release with the archives renamed, attestation
verified with `-R`). Private-repo skip reviewed by lalo, not yet run.
