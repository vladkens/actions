# homebrew-bump

Points a Homebrew formula in a tap at a release's archive: sets its `url`, `sha256` and `version` and pushes the change as github-actions[bot]; without a tag it does nothing. It gets a token that pushes to the tap and runs no project code.

A step in the `publish` job after [rust-publish](../rust-publish/), whose step has `id: release`:

```yaml
    - uses: vladkens/actions/homebrew-bump@v1
      with:
        tag: ${{ steps.release.outputs.tag }}
        file: target/distrib/<name>-${{ steps.release.outputs.tag }}-aarch64-apple-darwin.tar.gz
        tap: vladkens/homebrew-tap
        token: ${{ secrets.HOMEBREW_REPO_TOKEN }}
```

It handles formulas with one download. Pass that one archive as `file`: rust-publish's `files` lists every published file.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `tag` | | The released tag, e.g. rust-publish's `tag`; empty means nothing to do |
| `file` | | The released archive the formula downloads |
| `tap` | required | The tap, `owner/repo` on GitHub |
| `formula` | `<repo>.rb` | The formula's path in the tap |
| `url` | the release asset | The download URL; the release asset of `file` when empty |
| `token` | required | A token that can push to the tap; `GITHUB_TOKEN` can't reach another repo |

## Outputs

| Output | What it is |
| --- | --- |
| `changed` | `true` when the formula was updated and pushed |
