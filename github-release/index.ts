import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { env, fail, files, input, main, required, setOutput } from '../lib/core.ts'
import { findRelease, gh, setTag, tagCommit } from '../lib/github.ts'

await main(() => {
  const tag = required('tag')
  const sha = env('GITHUB_SHA')

  let notesFile = input('notes-file')
  if (!notesFile) {
    if (!input('notes')) fail("set 'notes' (release-check's output) or 'notes-file'")
    notesFile = join(process.env.RUNNER_TEMP || tmpdir(), `notes-${tag}.md`)
    writeFileSync(notesFile, input('notes'))
  } else if (!existsSync(notesFile)) {
    fail(`no ${notesFile}: 'notes-file' works only in the job that wrote it; pass 'notes' instead`)
  }

  const from = input('rename-from')
  const to = input('rename-to')
  if (Boolean(from) !== Boolean(to)) fail("set both 'rename-from' and 'rename-to', or neither")
  const paths = files('files').map((path) => {
    if (!from || !basename(path).includes(from)) return path
    const renamed = join(dirname(path), basename(path).replace(from, to))
    renameSync(path, renamed)
    return renamed
  })

  const at = tagCommit(tag)
  if (at && at !== sha) fail(`tag ${tag} already points to ${at}, not ${sha}`)
  if (!at) setTag(tag, sha)

  const release = findRelease(tag)
  if (!release) {
    const title = input('title') || tag
    gh(['release', 'create', tag, ...paths, '--verify-tag', '--title', title, '--notes-file', notesFile], true)
  } else {
    // A re-run keeps what is published: assets already there are downloaded over the local files,
    // so later steps (attestation, checksums) see the published bytes.
    for (const path of paths) {
      const name = basename(path)
      if (release.assets.includes(name)) {
        gh(['release', 'download', tag, '--pattern', name, '--dir', dirname(path), '--clobber'])
      } else {
        gh(['release', 'upload', tag, path], true)
      }
    }
    // `gh release create` uploads to a draft and publishes it last, deleting it on failure; finish
    // one whose deletion failed too.
    if (release.isDraft) gh(['release', 'edit', tag, '--draft=false'])
  }

  setOutput('files', paths.join('\n'))
})
