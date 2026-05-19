import { describe, it, expect } from 'vitest'
import { validateAmount } from '../app/lib/swap'

describe('validateAmount', () => {
  it('returns null for a valid positive numeric string', () => {
    expect(validateAmount('100')).toBeNull()
    expect(validateAmount('0.001')).toBeNull()
  })

  it('returns an error message for empty input', () => {
    expect(validateAmount('')).not.toBeNull()
    expect(validateAmount('  ')).not.toBeNull()
  })

  it('returns an error message for non-numeric input', () => {
    expect(validateAmount('abc')).not.toBeNull()
    expect(validateAmount('1e2')).not.toBeNull()
  })

  it('returns an error message for zero or negative', () => {
    expect(validateAmount('0')).not.toBeNull()
    expect(validateAmount('-5')).not.toBeNull()
  })
})
