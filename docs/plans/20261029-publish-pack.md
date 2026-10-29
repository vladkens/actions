# rust-publish's pack, and the dmg tools

nimbo apps ship more than archives (the .app and dmg, the setup, the appimage and deb, an update feed), made by the app's own `make pack` from rust-build's bare binaries. rust-publish runs it between the download and the check, and this repo builds the dmg tools nimbo's pack.py pins. Approved on 2026-10-29, as one PR.

- [x] rust-publish `pack`: after the download, release-check first, then the command with `LABEL` and `TAG`; the top-level files `<name>-dev-*`, renamed on a release like rust-build's, and `update.txt` published, subfolders skipped.
- [x] The files' check: main's loop, with pack subfolders skipped and update.txt accepted; test.yml's rust-publish job with a dummy pack and a wrong name.
- [x] `tools.yml`: static `dmg` and `hfsplus` from mozilla/libdmg-hfsplus at a pinned commit, released as `tools-<yyyymmdd>` with SHA256SUMS.
- [x] readme: pack with an example, the tools release.
- [ ] PR green; tools.yml run once, its release and hashes reported.
