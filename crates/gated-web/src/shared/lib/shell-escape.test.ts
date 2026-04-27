import { describe, expect, it } from 'vitest'
import { shellEscape } from './shell-escape'

// `shellEscape` picks Unix vs Windows quoting at module load based on
// `UAParser().getOS().name`. In jsdom the UA resolves to an empty string,
// so the module-level `isWin` is false and the Unix branch is active.
// These tests assert that Unix behaviour; a separate test that stubs the
// UA would be needed to cover the Windows branch.

describe('shellEscape (Unix branch, jsdom default UA)', () => {
  it('passes safe identifiers through untouched', () => {
    expect(shellEscape('host01')).toBe('host01')
    expect(shellEscape('path/to/file-1_v2')).toBe('path/to/file-1_v2')
  })

  it('wraps strings with shell metacharacters in single quotes', () => {
    expect(shellEscape('with space')).toBe('\'with space\'')
    expect(shellEscape('a;b')).toBe('\'a;b\'')
  })

  it('escapes embedded single quotes using the classic close-open dance', () => {
    // Expected form: 'can'"'"'t' — our sentinel is the `'"'"'` sequence.
    expect(shellEscape('can\'t')).toBe('\'can\'"\'"\'t\'')
  })

  it('joins an array of args with spaces, each independently escaped', () => {
    expect(shellEscape(['a', 'b c', 'd'])).toBe('a \'b c\' d')
  })
})
