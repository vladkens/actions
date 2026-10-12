import { state, warning } from '../lib/core.ts'
import { revoke } from './crates.ts'

// Revokes a token the main step got but couldn't revoke itself (cancelled, timed out).
const token = state('token')
if (token) await revoke(token).catch((err: unknown) => warning(String(err instanceof Error ? err.message : err)))
