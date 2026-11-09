import { fail } from "../lib/core.ts"

export const TARGETS = ["homebrew", "aur"] as const
export type Target = (typeof TARGETS)[number]

// `to`'s package managers, separated by commas, spaces or newlines, in order and without repeats.
export const parseTargets = (to: string): Target[] => {
  const names = [...new Set(to.split(/[\s,]+/).filter(Boolean))]
  if (!names.length) fail(`input 'to' is empty; expected some of ${TARGETS.join(", ")}`)
  for (const name of names) {
    if (!(TARGETS as readonly string[]).includes(name))
      fail(`unknown package manager '${name}' in 'to'; expected some of ${TARGETS.join(", ")}`)
  }

  return names as Target[]
}
