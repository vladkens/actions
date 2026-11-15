# rust-dist: cargo-zigbuild instead of cargo-cross

Done: 2026-11-15

cargo-cross downloads its GCC toolchains from `zijiren233/cross-make`. Since 2026-11-06 the repo sits in a new `cross-make` org that GitHub hid, so every download is a 404 (zijiren233/cargo-cross#21): Linux and Windows targets build only while the toolchains are in the Actions cache. Approved on 2026-11-15: zig as the C compiler and linker, from PyPI, as wavo-app's checks already use it.

- [x] rust-dist: `cargo zigbuild` for every non-Apple target, `<target>.2.28` for glibc, cargo-zigbuild 0.23.4 and ziglang 0.16.0 in a venv, pinned versions in `rust-dist/index.ts`; archives, their names and the `files` output unchanged.
- [x] rust-build caches `~/.cache/zig` instead of `~/.cache/cargo-cross`; readme.
- [x] test.yml: the macos job also builds aarch64 musl and x86_64 Windows and checks their archives; the Linux one checks the binary needs glibc 2.28 at most.
- [x] Local builds of wavo, cctrail, clankr, shipo and ghstats for their workflow's targets.
- [x] PR green.

## Result

#14 green: `blocks` builds the fixture on Linux and checks it needs glibc 2.28 at most, and `macos` builds it for Apple, Linux gnu, Linux musl and Windows. wavo, cctrail and clankr (gnu, Windows), shipo (musl, Windows) and ghstats (musl) build locally on a Mac with it, and their Linux binaries run on Debian 10 or Alpine. `v1` is not moved.
