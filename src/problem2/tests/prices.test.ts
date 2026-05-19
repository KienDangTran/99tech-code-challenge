import { describe, it, expect } from 'vitest'
import { normalizeTokens, type RawPriceEntry } from '../app/lib/prices'

describe('normalizeTokens', () => {
  it('keeps the latest price per currency, drops entries without a positive price, and sorts alphabetically', () => {
    const raw: RawPriceEntry[] = [
      { currency: 'ETH', date: '2023-08-29T07:10:00.000Z', price: 1700 },
      { currency: 'BTC', date: '2023-08-30T07:10:00.000Z', price: 26000 },
      { currency: 'ETH', date: '2023-08-30T07:10:00.000Z', price: 1750 },
      { currency: 'NOPRICE', date: '2023-08-29T07:10:00.000Z' } as RawPriceEntry,
      { currency: 'ZERO', date: '2023-08-29T07:10:00.000Z', price: 0 },
    ]
    expect(normalizeTokens(raw)).toEqual([
      { currency: 'BTC', price: 26000 },
      { currency: 'ETH', price: 1750 },
    ])
  })
})
