import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assetSteps } from '../github-release/assets.ts'

test('a published release keeps its assets and gets the missing ones', () => {
  const release = { isDraft: false, assets: ['a.tar.gz', 'update.txt'] }
  assert.deepEqual(assetSteps(release, ['a.tar.gz', 'b.zip', 'update.txt']), ['download', 'upload', 'download'])
})

test('a draft takes every file anew', () => {
  const release = { isDraft: true, assets: ['a.tar.gz'] }
  assert.deepEqual(assetSteps(release, ['a.tar.gz', 'update.txt']), ['replace', 'replace'])
  assert.deepEqual(assetSteps({ isDraft: true, assets: [] }, []), [])
})
