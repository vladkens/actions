# rust.yml: a Rust repo's release process as one reusable workflow

The four actions leave ~70 lines of wiring per repo (jobs, permissions, artifacts, passing tag and
notes). `rust.yml` owns dev build → `dev` pre-release and release commit → check → crates.io →
GitHub release with the renamed dev archives and attestations; a repo keeps its test jobs and one
calling job.

Checked from primary sources: crates.io matches the caller's `workflow_ref`, so Trusted Publishing
settings keep naming the caller's file; attestations are signed by rust.yml (verify with
`--signer-repo vladkens/actions`); called jobs can only narrow the caller's permissions; `$/`
runs this repo's actions at rust.yml's own commit.

- [x] `rust.yml` with inputs for wavo, macmon, unjar and badgelib: `dist`, `runner`, `name`,
      `cache`, `cache-directories`, `crates`, `dev-tag`, `dev-branch`; output `tag`.
- [x] `test.yml`: the dist → dev-release path with a fake build and a throwaway tag, including
      `gh attestation verify`.
- [ ] Green on the branch (`workflow_dispatch`), then a PR for the person.
- [ ] The release path proven by wavo's first release through it.
