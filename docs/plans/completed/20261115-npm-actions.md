# npm-build and npm-publish

Done: 2026-11-15

apigen-ts and url-normalize release like the Rust and Python repos: a squash-merged release PR tags the commit and publishes to npm through Trusted Publishing, with no tag pushed by hand. Approved on 2026-11-15, as one PR here and one migration PR per repo.

- [x] npm-build: refuses a job with `id-token: write`, checks a release PR, installs with pnpm or `npm ci` by the lockfile, runs `build` if present, packs and uploads the tarball.
- [x] npm-publish: on a release commit release-check, the tarball's file name and its `package.json` against the checkout, github-release, then `npm publish --ignore-scripts` outside the checkout unless the version is on npm.
- [x] test.yml: npm-build on an npm and a pnpm fixture, refused with `id-token: write`, npm-publish doing nothing outside a release.
- [x] readme: both actions, the tables and an npm repo example.
- [x] PR green.

## Result

#13 green: `blocks` builds an npm and a pnpm fixture, refuses a job with `id-token: write`, and npm-publish does nothing outside a release. apigen-ts (#33) and url-normalize (#7) are migrated on `@npm-actions`, to switch to `@v1` once it moves; their first release proves the publish path. `v1` is not moved.
