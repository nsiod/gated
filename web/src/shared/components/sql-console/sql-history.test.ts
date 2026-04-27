import { beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_MAX, loadHistory, saveHistory } from './sql-history'

beforeEach(() => {
  localStorage.clear()
})

describe('loadHistory / saveHistory', () => {
  it('round-trips entries through localStorage per target', () => {
    saveHistory('mysql-a', [
      { id: '1', sql: 'SELECT 1', at: 1 },
      { id: '2', sql: 'SELECT 2', at: 2 },
    ])
    const loaded = loadHistory('mysql-a')
    expect(loaded).toHaveLength(2)
    expect(loaded.map(e => e.sql)).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('scopes history per target (different target → empty)', () => {
    saveHistory('mysql-a', [{ id: '1', sql: 'SELECT 1', at: 1 }])
    expect(loadHistory('mysql-b')).toEqual([])
  })

  it('returns [] when the stored value is corrupt JSON', () => {
    localStorage.setItem('gated:sql-history:mysql-a', '{not-json')
    expect(loadHistory('mysql-a')).toEqual([])
  })

  it('returns [] when the stored value is the wrong shape (not an array)', () => {
    localStorage.setItem('gated:sql-history:mysql-a', JSON.stringify({ rogue: true }))
    expect(loadHistory('mysql-a')).toEqual([])
  })

  it('save truncates entries to HISTORY_MAX', () => {
    const big = Array.from({ length: HISTORY_MAX + 10 }, (_, i) => ({
      id: String(i),
      sql: `SELECT ${i}`,
      at: i,
    }))
    saveHistory('mysql-a', big)
    expect(loadHistory('mysql-a')).toHaveLength(HISTORY_MAX)
  })
})
