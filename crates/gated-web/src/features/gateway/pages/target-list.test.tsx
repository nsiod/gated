import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useInfoQuery, useTargetsQuery } from '@/features/gateway/api'
import { I18nTestProvider } from '@/shared/testing/i18n'
import { Component } from './target-list'

vi.mock('@/features/gateway/api', () => ({
  useInfoQuery: vi.fn(),
  useTargetsQuery: vi.fn(),
}))

describe('gateway target list api targets', () => {
  it('copies an API curl command instead of rendering a direct link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })

    vi.mocked(useTargetsQuery).mockReturnValue({
      data: [
        {
          name: 'httpbin',
          kind: 'Api',
          description: '',
          group: null,
        },
      ],
      isPending: false,
      isSuccess: true,
    } as unknown as ReturnType<typeof useTargetsQuery>)
    vi.mocked(useInfoQuery).mockReturnValue({
      data: {
        external_host: 'gated.vvor.dev',
      },
    } as unknown as ReturnType<typeof useInfoQuery>)

    render(
      <MemoryRouter>
        <I18nTestProvider>
          <Component />
        </I18nTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText(`curl -H 'X-Gated-Target: httpbin' -H 'x-gated-token: <TOKEN>' https://gated.vvor.dev/`)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'https://gated.vvor.dev' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'targetList.copyCommand' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`curl -H 'X-Gated-Target: httpbin' -H 'x-gated-token: <TOKEN>' https://gated.vvor.dev/`)
    })
  })
})
