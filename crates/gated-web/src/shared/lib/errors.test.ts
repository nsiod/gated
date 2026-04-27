import { describe, expect, it } from 'vitest'
import { stringifyError } from './errors'

describe('stringifyError', () => {
  it('reads body text from a bare Response', async () => {
    const r = new Response('server boom', { status: 500 })
    expect(await stringifyError(r)).toBe('API error: server boom')
  })

  it('unwraps the `response` Response on fetch-like errors', async () => {
    const err = { response: new Response('nope', { status: 400 }) }
    expect(await stringifyError(err)).toBe('API error: nope')
  })

  it('falls back to String() for Error instances', async () => {
    expect(await stringifyError(new Error('kaboom'))).toBe('Error: kaboom')
  })

  it('falls back to String() for plain values', async () => {
    expect(await stringifyError(null)).toBe('null')
    expect(await stringifyError(42)).toBe('42')
  })
})
