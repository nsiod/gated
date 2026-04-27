import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdom doesn't tear the DOM down between tests; keep it clean so one
// test's render doesn't leak into the next test's query results.
afterEach(() => {
  cleanup()
})
