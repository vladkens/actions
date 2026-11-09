# package-publish: one action for every package manager

Done: 2026-11-09

A release goes to Homebrew today through homebrew-bump, and wavo-app needs a Homebrew cask and the AUR too. One action, `package-publish`, takes the list of managers in `to`, so a new manager is a new list entry in each repo, not a new step. Agreed on 2026-11-09.

- [x] lib: homebrew-bump's formula code and tap push moved to `lib/homebrew.ts`, git helpers to `lib/git.ts`, release files (local or downloaded with gh) to `lib/release-files.ts`; homebrew-bump a thin wrapper, unchanged for its users.
- [x] Homebrew cask: `Casks/<name>.rb`, its `version` and `sha256` set from the release file its `url` names (literal or with `#{version}`).
- [x] `package-publish`: `to` parsed (commas, spaces, newlines), an unknown name fails; `homebrew` bumps a formula (`Formula/<name>.rb` or `<name>.rb`) or a cask; `aur` clones the package over ssh with the key in a 600 temp file, sets pkgver, pkgrel and the per-arch sha256sums in PKGBUILD and .SRCINFO, checks the sources use `$pkgver`, commits `<pkg> <version>` and pushes; a package already at the version is left alone.
- [x] tests/package-publish.test.ts: the PKGBUILD/.SRCINFO edit, `to` parsing, the cask edit; test.yml runs it against a local tap and AUR repo.
- [x] Docs: package-publish/readme.md, the top readme's table, homebrew-bump's readme points to package-publish.

## Result

package-publish publishes a release to the managers in `to`: `homebrew` (a formula, or a cask with `homebrew-cask`) and `aur` (a `-bin` package's PKGBUILD and .SRCINFO over ssh). homebrew-bump runs on the same lib code with its inputs and behaviour unchanged. Unit tests cover the AUR edit, `to` parsing and the cask edit; test.yml bumps a local tap's cask and a local AUR repo, re-runs with no change and fails an unknown manager. Not yet run against the real AUR or tap: wavo-app's first release with it will be.
