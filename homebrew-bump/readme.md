# homebrew-bump

Points a Homebrew formula in a tap at a release's archives: sets its `url`, `sha256` and `version` and pushes the change as github-actions[bot]; without a tag it does nothing. It gets a token that pushes to the tap and runs no project code.

A step in the `publish` job after [rust-publish](../rust-publish/), whose step has `id: release`:

```yaml
    - uses: vladkens/actions/homebrew-bump@v1
      with:
        tag: ${{ steps.release.outputs.tag }}
        file: target/distrib/<name>-${{ steps.release.outputs.tag }}-aarch64-apple-darwin.tar.gz
        tap: vladkens/homebrew-tap
        token: ${{ secrets.HOMEBREW_REPO_TOKEN }}
```

A formula with one download takes that archive as `file`. A formula with a download per platform takes several, usually rust-publish's whole `files`: each `url`, with the `sha256` right after it, moves to the file of the same name but for the version. Files it doesn't download are skipped, and a `url` without a file fails the step.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `tag` | | The released tag, e.g. rust-publish's `tag`; empty means nothing to do |
| `file` | | The released archive the formula downloads, or one per line for a download per platform |
| `tap` | required | The tap, `owner/repo` on GitHub |
| `formula` | `<repo>.rb` | The formula's path in the tap |
| `url` | the release asset | The download URL of a single `file` |
| `token` | required | A token that can push to the tap; `GITHUB_TOKEN` can't reach another repo |

## Outputs

| Output | What it is |
| --- | --- |
| `changed` | `true` when the formula was updated and pushed |
