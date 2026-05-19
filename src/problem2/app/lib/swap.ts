const VALID_AMOUNT = /^\d+(\.\d+)?$/

export function validateAmount(input: string): string | null {
  if (!input.trim()) return 'Amount is required'
  if (!VALID_AMOUNT.test(input.trim())) return 'Enter a valid number'
  const n = parseFloat(input)
  if (n <= 0) return 'Amount must be greater than zero'
  return null
}

export function computeReceive(
  amount: number,
  fromPrice: number,
  toPrice: number,
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!(fromPrice > 0) || !(toPrice > 0)) return null
  return (amount * fromPrice) / toPrice
}
