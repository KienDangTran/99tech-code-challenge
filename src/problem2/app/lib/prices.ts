export interface RawPriceEntry {
  currency: string
  date: string
  price?: number
}

export interface Token {
  currency: string
  price: number
}

export function normalizeTokens(raw: RawPriceEntry[]): Token[] {
  const latest = new Map<string, RawPriceEntry>()
  for (const entry of raw) {
    if (typeof entry.price !== 'number' || !(entry.price > 0)) continue
    const prev = latest.get(entry.currency)
    if (!prev || new Date(entry.date) > new Date(prev.date)) {
      latest.set(entry.currency, entry)
    }
  }
  return [...latest.values()]
    .map(({ currency, price }) => ({ currency, price: price as number }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}
