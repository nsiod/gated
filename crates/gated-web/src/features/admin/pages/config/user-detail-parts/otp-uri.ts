// RFC 4648 base32 + otpauth:// URI builder used by the OTP credential
// tab to generate QR codes in `otp-tab.tsx`. Lives here (not in
// `shared/lib/`) because the only caller is the user-detail page.

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function toBase32(bytes: Uint8Array): string {
  let result = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31]
  }
  return result
}

export function buildOtpUri(username: string, secret: Uint8Array): string {
  const b32 = toBase32(secret)
  const label = encodeURIComponent(`Gated:${username}`)
  return `otpauth://totp/${label}?secret=${b32}&issuer=Gated`
}
