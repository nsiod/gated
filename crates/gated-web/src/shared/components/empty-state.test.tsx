import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './empty-state'

describe('<EmptyState />', () => {
  it('renders the default title when no props are passed', () => {
    render(<EmptyState />)
    expect(screen.getByRole('heading', { name: 'No data' })).toBeInTheDocument()
  })

  it('renders a custom title and description', () => {
    render(<EmptyState title="Nothing here" description="try another filter" />)
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
    expect(screen.getByText('try another filter')).toBeInTheDocument()
  })

  it('omits the description paragraph when description is empty', () => {
    const { container } = render(<EmptyState title="x" description="" />)
    expect(container.querySelector('p')).toBeNull()
  })

  it('renders an action slot when provided', () => {
    render(<EmptyState title="x" action={<button type="button">Go</button>} />)
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })
})
