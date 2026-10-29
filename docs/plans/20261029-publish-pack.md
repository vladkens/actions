# rust-publish's pack, and the dmg tools

nimbo apps ship more than archives (the .app and dmg, the setup, the appimage and deb, an update feed), made by the app's own `make pack` from rust-build's bare binaries. rust-publish runs it between the download and the check, and this repo builds the dmg tools nimbo's pack.py pins. Approved on 2026-10-29, as one PR.

- [x] rust-publish `pack`: after the download, release-check first, dev-version in dev, the command with `LABEL` and `TAG`; the top-level files `<name>-<LABEL>-*` and `update.txt` published as named, subfolders skipped.
- [x] rust-publish `dry-run`: everything up to publishing, nothing published, for tests.
- [x] The files' check in `rust-publish/files.sh`, unit-tested on fixtures; a test.yml job with a dummy pack.
- [x] `tools.yml`: static `dmg` and `hfsplus` from mozilla/libdmg-hfsplus at a pinned commit, released as `tools-<yyyymmdd>` with SHA256SUMS.
- [x] readme: pack with an example, the tools release.
- [ ] PR green; tools.yml run once, its release and hashes reported.
