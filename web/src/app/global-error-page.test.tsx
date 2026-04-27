import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { summarizeRouteError } from '@/app/global-error-page.lib'
import { I18nTestProvider } from '@/shared/testing/i18n'
import { GlobalErrorPagePreview } from './global-error-page'

describe('summarizeRouteError', () => {
  it('returns the error message for Error instances', () => {
    expect(summarizeRouteError(new Error('boom'))).toBe('boom')
  })

  it('returns status information for Response instances', () => {
    expect(summarizeRouteError(new Response(null, { status: 503, statusText: 'Service Unavailable' }))).toBe('503 Service Unavailable')
  })
})

describe('globalErrorPagePreview', () => {
  it('renders recovery actions and chunk-load guidance', () => {
    render(
      <MemoryRouter>
        <I18nTestProvider>
          <GlobalErrorPagePreview error={new Error('Failed to fetch dynamically imported module: https://example.test/ui/assets/target-detail.js')} />
        </I18nTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('errorPage.title')).toBeInTheDocument()
    expect(screen.getByText('errorPage.chunkDescription')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'errorPage.actions.retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'errorPage.actions.dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'errorPage.actions.back' })).toBeInTheDocument()
  })
})
