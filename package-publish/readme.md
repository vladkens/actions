# package-publish

Publishes a release to the package managers listed in `to` by bumping the repos that hold their packages, and pushes each change as github-actions[bot]; without a tag it does nothing. Each package is created by hand once and its repo stays the source of truth: the action only moves it to the release. It gets the tokens and keys that push there and runs no project code.

A step in the `publish` job after [rust-publish](../rust-publish/), whose step has `id: release`:

```yaml
    - uses: vladkens/actions/package-publish@v1
      with:
        tag: ${{ steps.release.outputs.tag }}
        files: ${{ steps.release.outputs.files }}
        to: homebrew, aur
        homebrew-tap: vladkens/homebrew-tap
        homebrew-token: ${{ secrets.HOMEBREW_REPO_TOKEN }}
        aur-package: wavo-app-bin
        aur-ssh-key: ${{ secrets.AUR_SSH_KEY }}
```

A new package manager is one more name in `to` and its inputs. An unknown name fails the step on every run, release or not; each manager's inputs are checked before anything is pushed. A re-run leaves what is already at the release alone.

`files` are the release's local files; when it is empty, the tag's release assets are used, each downloaded only when a package needs its checksum (with `token`), so a past release can be published with `workflow_dispatch` and just a `tag`.

## homebrew

A formula, `Formula/<name>.rb` or `<name>.rb` in the tap (the repo's name by default), as [homebrew-bump](../homebrew-bump/) does it: one `url` moves to the one file, or each `url` with the `sha256` right after it to the file of the same name but for the version (one download per platform); `version` follows when present.

A cask instead with `homebrew-cask: <name>`, at `Casks/<name>.rb`, for an app's .dmg: its `version` and `sha256` are set for the file its `url` downloads. A `url` with `#{version}` names that file once the version is in and is kept; a literal one moves to the file of the same name. Only single-download casks: one `url` and one `sha256 "…"`.

## aur

A `-bin` package that installs the release's .deb per arch. The action clones `ssh://aur@aur.archlinux.org/<aur-package>.git` with the key (written to a temp file with mode 600, removed at the end, never printed; the host key is accepted on first use), and in PKGBUILD and .SRCINFO sets `pkgver` to the tag without its `v`, `pkgrel=1` and each `sha256sums_<arch>` to the checksum of the release's `*-linux-<arch>.deb` (x86_64, aarch64). It commits `<package> <version>` and pushes; a package whose `pkgver` already is the version is left as it is, `pkgrel` included.

The PKGBUILD's per-arch arrays hold one entry each, and its `source_<arch>` URLs use `$pkgver`, so they need no edit:

```sh
source_x86_64=("https://github.com/vladkens/wavo-app/releases/download/v$pkgver/Wavo-v$pkgver-linux-x86_64.deb")
sha256sums_x86_64=('…')
```

makepkg isn't on the runner, so .SRCINFO is edited as text: its sources get the new version and must then end in the file's name, or the step fails. A version with `-` (a pre-release) can't be a pkgver and fails the step.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `tag` | | The released tag, e.g. rust-publish's `tag`; empty means nothing to do |
| `files` | the release's assets | The release's files, globs one per line, e.g. rust-publish's `files` |
| `to` | required | The package managers, separated by commas, spaces or newlines: `homebrew`, `aur` |
| `token` | `github.token` | Reads the release's assets when `files` is empty |
| `homebrew-tap` | | The tap, `owner/repo` on GitHub |
| `homebrew-token` | | A token that can push to the tap; `GITHUB_TOKEN` can't reach another repo |
| `homebrew-formula` | the repo's name | The formula's name |
| `homebrew-cask` | | A cask's name, bumped instead of a formula |
| `aur-package` | | The AUR package, e.g. `wavo-app-bin` |
| `aur-ssh-key` | | The private ssh key of the AUR account that maintains it |

## Outputs

| Output | What it is |
| --- | --- |
| `changed` | `true` when any package was updated and pushed |
| `updated` | The package managers updated, space-separated (`homebrew aur`); empty when none |
