import { describe, it, expect } from 'vitest'
import { computeReceive } from '../app/lib/swap'

describe('computeReceive', () => {
  it('returns amount * fromPrice / toPrice for valid inputs', () => {
    expect(computeReceive(100, 1, 2)).toBe(50)
    expect(computeReceive(2, 1500, 1)).toBe(3000)
  })

  it('returns null for non-positive or non-finite amount', () => {
    expect(computeReceive(0, 1, 1)).toBeNull()
    expect(computeReceive(-1, 1, 1)).toBeNull()
    expect(computeReceive(Number.NaN, 1, 1)).toBeNull()
  })

  it('returns null when either price is missing or zero', () => {
    expect(computeReceive(1, 0, 1)).toBeNull()
    expect(computeReceive(1, 1, 0)).toBeNull()
  })
})
