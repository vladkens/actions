import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fail, input, main, setOutput } from '../lib/core.ts'
import { MANIFESTS, manifestVersion } from '../lib/manifest.ts'
import { changelogNotes, commitTitle, hasEntry } from './notes.ts'

await main(() => {
  const manifest = input('manifest') || MANIFESTS.find((x) => existsSync(x))
  if (!manifest) fail(`no ${MANIFESTS.join(', ')} here; set 'manifest'`)
  const version = manifestVersion(manifest, readFileSync(manifest, 'utf8'))
  const tag = `v${version}`

  const title = commitTitle(input('message'))
  if (title !== `release: ${tag}`) {
    fail(`expected the commit title 'release: ${tag}' (from ${manifest}), got '${title}'`)
  }

  const changelog = input('changelog')
  if (!existsSync(changelog)) fail(`no ${changelog}`)
  const notes = changelogNotes(readFileSync(changelog, 'utf8'), tag)
  if (!hasEntry(notes)) fail(`${changelog} has no '## ${tag}' section with a '- ' entry`)

  const notesFile = join(process.env.RUNNER_TEMP || tmpdir(), `notes-${tag}.md`)
  writeFileSync(notesFile, `${notes}\n`)

  setOutput('tag', tag)
  setOutput('version', version)
  setOutput('notes', notes)
  setOutput('notes-file', notesFile)
  console.log(`release ${tag}, notes from ${changelog}:\n\n${notes}`)
})
