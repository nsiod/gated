const PALETTE = [
  'bg-tone-red text-tone-red-fg',
  'bg-tone-orange text-tone-orange-fg',
  'bg-tone-amber text-tone-amber-fg',
  'bg-tone-green text-tone-green-fg',
  'bg-tone-teal text-tone-teal-fg',
  'bg-tone-blue text-tone-blue-fg',
  'bg-tone-indigo text-tone-indigo-fg',
  'bg-tone-purple text-tone-purple-fg',
  'bg-tone-pink text-tone-pink-fg',
] as const

export function avatarColor(seed: string | null | undefined): string {
  if (seed == null || seed === '')
    return PALETTE[0]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}
