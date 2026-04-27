import { describe, expect, it } from 'vitest'
import { recordingMetadataToFieldSet, recordingTypeLabel } from './recordings'

describe('recordingMetadataToFieldSet', () => {
  it('maps mysql terminal metadata to a target field', () => {
    expect(recordingMetadataToFieldSet({ type: 'mysql-terminal', target: 'mysql-prod' })).toEqual([
      ['Target', 'mysql-prod'],
    ])
  })

  it('maps postgres terminal metadata to a target field', () => {
    expect(recordingMetadataToFieldSet({ type: 'postgres-terminal', target: 'pg-analytics' })).toEqual([
      ['Target', 'pg-analytics'],
    ])
  })

  it('maps mysql proxy session metadata to target and database fields', () => {
    expect(recordingMetadataToFieldSet({
      type: 'mysql-proxy-session',
      target: 'mysql-prod',
      database: 'app',
    })).toEqual([
      ['Target', 'mysql-prod'],
      ['Database', 'app'],
    ])
  })
})

describe('recordingTypeLabel', () => {
  it('returns a SQL Console label for SQL Console recordings', () => {
    expect(recordingTypeLabel(JSON.stringify({
      type: 'sql-console-session',
      target_kind: 'mysql',
      target: 'mysql-prod',
    }))).toBe('SQL Console Session')
  })

  it('returns a MySQL label for mysql terminal recordings', () => {
    expect(recordingTypeLabel(JSON.stringify({ type: 'mysql-terminal', target: 'mysql-prod' }))).toBe('MySQL Terminal')
  })

  it('returns a Postgres label for postgres terminal recordings', () => {
    expect(recordingTypeLabel(JSON.stringify({ type: 'postgres-terminal', target: 'pg-analytics' }))).toBe('Postgres Terminal')
  })

  it('returns a MySQL proxy label for mysql proxy recordings', () => {
    expect(recordingTypeLabel(JSON.stringify({
      type: 'mysql-proxy-session',
      target: 'mysql-prod',
      database: 'app',
    }))).toBe('MySQL Proxy Session')
  })
})
