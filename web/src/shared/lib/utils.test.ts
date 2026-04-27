import { describe, expect, it } from 'vitest'
import { cn, isBlank } from './utils'

describe('isBlank', () => {
  it('returns true for null and undefined', () => {
    expect(isBlank(null)).toBe(true)
    expect(isBlank(undefined)).toBe(true)
  })

  it('returns true for the empty string', () => {
    expect(isBlank('')).toBe(true)
  })

  it('returns false for any non-empty string (including whitespace — we only guard nullish/"")', () => {
    expect(isBlank('a')).toBe(false)
    expect(isBlank(' ')).toBe(false)
  })
})

describe('cn', () => {
  it('merges tailwind class lists', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('filters nullish entries', () => {
    expect(cn('text-sm', null, undefined, false, 'font-bold')).toBe('text-sm font-bold')
  })
})
