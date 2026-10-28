import assert from 'node:assert/strict'
import { test } from 'node:test'
import { identity } from '../macos-sign/sign.ts'

test('the first identity, trusted or not', () => {
  const listing = [
    'Policy: Code Signing',
    '  Matching identities',
    '  1) E00087BDD71F8F29D6E4213BE04F8CF15C0DB969 "Developer ID Application: Name (TEAM)"',
    '  2) 200896BC436E0945447BF36C669C0877C83CFD93 "Other" (CSSMERR_TP_NOT_TRUSTED)',
    '     2 identities found',
  ].join('\n')
  assert.deepEqual(identity(listing), {
    hash: 'E00087BDD71F8F29D6E4213BE04F8CF15C0DB969',
    name: 'Developer ID Application: Name (TEAM)',
  })
  assert.equal(identity('  1) 200896BC436E0945447BF36C669C0877C83CFD93 "x" (CSSMERR_TP_NOT_TRUSTED)')?.name, 'x')
  assert.equal(identity('     0 identities found'), undefined)
})
