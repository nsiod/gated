import { describe, expect, it } from 'vitest'
import { buildCreateTicketRequest } from './create-ticket-request'

describe('buildCreateTicketRequest', () => {
  it('omits optional fields when they are blank', () => {
    expect(buildCreateTicketRequest({
      username: 'alice',
      target_name: 'postgres-prod',
      expiry: '',
      number_of_uses: '',
      description: '',
    })).toEqual({
      username: 'alice',
      target_name: 'postgres-prod',
      expiry: undefined,
      number_of_uses: undefined,
      description: undefined,
    })
  })

  it('serializes datetime-local expiry as RFC3339', () => {
    const req = buildCreateTicketRequest({
      username: 'alice',
      target_name: 'postgres-prod',
      expiry: '2026-04-23T12:30',
      number_of_uses: '3',
      description: 'temporary access',
    })

    expect(req.expiry).toBe(new Date('2026-04-23T12:30').toISOString())
    expect(req.expiry).toMatch(/Z$/)
    expect(req.number_of_uses).toBe(3)
    expect(req.description).toBe('temporary access')
  })
})
