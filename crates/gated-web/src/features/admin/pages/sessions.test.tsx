import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCleanSessionsMutation, useCloseSessionMutation, useSessionsQuery } from '@/features/admin/api'
import { I18nTestProvider } from '@/shared/testing/i18n'
import { Component } from './sessions'

const navigateMock = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/features/admin/api', () => ({
  useSessionsQuery: vi.fn(),
  useCloseSessionMutation: vi.fn(),
  useCleanSessionsMutation: vi.fn(),
}))

describe('admin sessions search', () => {
  it('matches rows by visible target name', () => {
    vi.mocked(useSessionsQuery).mockReturnValue({
      data: {
        items: [
          {
            id: 'session-1',
            username: 'alice',
            target: { id: 'target-1', name: 'Target Alpha', options: { kind: 'Ssh' } },
            protocol: 'ssh',
            started: '2026-04-23T12:00:00Z',
            ended: '',
          },
          {
            id: 'session-2',
            username: 'bob',
            target: { id: 'target-2', name: 'Database Prod', options: { kind: 'Postgres' } },
            protocol: 'postgres',
            started: '2026-04-23T13:00:00Z',
            ended: '',
          },
        ],
      },
      isLoading: false,
    } as ReturnType<typeof useSessionsQuery>)
    vi.mocked(useCloseSessionMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useCloseSessionMutation>)
    vi.mocked(useCleanSessionsMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useCleanSessionsMutation>)

    render(
      <I18nTestProvider>
        <Component />
      </I18nTestProvider>,
    )

    expect(screen.getByText('Target Alpha')).toBeInTheDocument()
    expect(screen.getByText('Database Prod')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Target' } })

    expect(screen.getByText('Target Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Database Prod')).not.toBeInTheDocument()
  })
})
