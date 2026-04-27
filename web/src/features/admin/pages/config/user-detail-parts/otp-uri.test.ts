import { describe, expect, it } from 'vitest'
import { buildOtpUri, toBase32 } from './otp-uri'

describe('toBase32', () => {
  it('encodes empty input as empty string', () => {
    expect(toBase32(new Uint8Array([]))).toBe('')
  })

  it('encodes RFC 4648 test vectors', () => {
    // Vectors from RFC 4648 §10, "foobar" split into progressively
    // longer prefixes. Using `TextEncoder` keeps the test readable.
    const enc = new TextEncoder()
    expect(toBase32(enc.encode('f'))).toBe('MY')
    expect(toBase32(enc.encode('fo'))).toBe('MZXQ')
    expect(toBase32(enc.encode('foo'))).toBe('MZXW6')
    expect(toBase32(enc.encode('foob'))).toBe('MZXW6YQ')
    expect(toBase32(enc.encode('fooba'))).toBe('MZXW6YTB')
    expect(toBase32(enc.encode('foobar'))).toBe('MZXW6YTBOI')
  })
})

describe('buildOtpUri', () => {
  it('returns a well-formed otpauth:// URI with the base32-encoded secret', () => {
    const secret = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]) // "Hello"
    const uri = buildOtpUri('alice', secret)
    expect(uri.startsWith('otpauth://totp/')).toBe(true)
    expect(uri).toContain('issuer=Gated')
    // Label: "Gated:alice" url-encoded — the ':' becomes %3A.
    expect(uri).toContain('Gated%3Aalice')
    expect(uri).toContain(`secret=${toBase32(secret)}`)
  })

  it('url-encodes usernames with special characters so the TOTP label parses', () => {
    const uri = buildOtpUri('user+tag@example.com', new Uint8Array([1, 2, 3]))
    expect(uri).toContain('user%2Btag%40example.com')
  })
})
