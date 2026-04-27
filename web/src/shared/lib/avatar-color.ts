const PALETTE = [
  'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100',
  'bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100',
  'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100',
  'bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100',
  'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
  'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100',
  'bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100',
  'bg-pink-100 text-pink-900 dark:bg-pink-900 dark:text-pink-100',
] as const

export function avatarColor(seed: string | null | undefined): string {
  if (seed == null || seed === '')
    return PALETTE[0]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}
