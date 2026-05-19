import { useState, useEffect, useMemo } from 'react'
import type { Token } from '../lib/prices'
import { normalizeTokens } from '../lib/prices'
import { computeReceive, validateAmount } from '../lib/swap'

type Status = 'idle' | 'loading' | 'success'

interface Props {
  submitDelay?: number
}

function TokenIcon({ currency }: { currency: string }) {
  const [failed, setFailed] = useState(false)

  if (!currency || failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
        {currency?.slice(0, 2) ?? '??'}
      </div>
    )
  }
  return (
    <img
      src={`https://raw.githubusercontent.com/Switcheo/token-icons/main/tokens/${currency}.svg`}
      alt={currency}
      width={32}
      height={32}
      onError={() => setFailed(true)}
      className="w-8 h-8 rounded-full shrink-0"
    />
  )
}

function TokenSelect({
  id,
  tokens,
  value,
  onChange,
}: {
  id: string
  tokens: Token[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative flex items-center gap-2 bg-zinc-700/60 rounded-xl pl-2 pr-8 py-2 min-w-[130px]">
      <TokenIcon currency={value} />
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-transparent text-white font-semibold text-sm outline-none cursor-pointer w-full"
      >
        {tokens.map(t => (
          <option key={t.currency} value={t.currency} className="bg-zinc-800">
            {t.currency}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  )
}

function fmt(n: number): string {
  return n < 1 ? n.toPrecision(6) : n.toFixed(4)
}

export default function SwapForm({ submitDelay = 2000 }: Props) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [fromCurrency, setFromCurrency] = useState('')
  const [toCurrency, setToCurrency] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    fetch('https://interview.switcheo.com/prices.json')
      .then(r => r.json())
      .then((data: unknown[]) => {
        const t = normalizeTokens(data as Parameters<typeof normalizeTokens>[0])
        setTokens(t)
        if (t.length >= 1) setFromCurrency(t[0].currency)
        if (t.length >= 2) setToCurrency(t[1].currency)
      })
  }, [])

  const priceMap = useMemo(
    () => new Map<string, number>(tokens.map(t => [t.currency, t.price])),
    [tokens],
  )

  const fromPrice = priceMap.get(fromCurrency) ?? 0
  const toPrice = priceMap.get(toCurrency) ?? 0

  const amountError = amount ? validateAmount(amount) : null
  const receiveAmount =
    amountError === null && amount !== ''
      ? computeReceive(parseFloat(amount), fromPrice, toPrice)
      : null
  const rate = fromPrice > 0 && toPrice > 0 ? fromPrice / toPrice : null

  const canSubmit = amountError === null && amount !== '' && status === 'idle'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('loading')
    setTimeout(() => setStatus('success'), submitDelay)
  }

  const handleSwapDirection = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 rounded-2xl p-8 ring-1 ring-zinc-700/50 shadow-2xl text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-white text-xl font-semibold">Swap confirmed!</p>
          <p className="text-zinc-400 text-sm mt-1">Your transaction has been submitted</p>
          <button
            type="button"
            onClick={() => { setStatus('idle'); setAmount('') }}
            className="mt-6 w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors font-medium"
          >
            New Swap
          </button>
        </div>
      </div>
    )
  }

  const isLoadingTokens = tokens.length === 0

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl shadow-2xl ring-1 ring-zinc-700/50 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-2 flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <span className="text-white font-semibold">Swap</span>
        </div>

        <div className="px-4 pb-4 space-y-1.5">
          {/* From panel */}
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <label htmlFor="from-token" className="text-xs font-medium text-zinc-400 block mb-3">
              From
            </label>
            {isLoadingTokens ? (
              <div className="h-10 bg-zinc-700/50 rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <TokenSelect
                  id="from-token"
                  tokens={tokens}
                  value={fromCurrency}
                  onChange={setFromCurrency}
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor="amount" className="sr-only">Amount to send</label>
                  <input
                    id="amount"
                    type="text"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-transparent text-white text-2xl font-semibold text-right outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Swap direction button */}
          <div className="flex justify-center py-0.5">
            <button
              type="button"
              aria-label="Swap direction"
              onClick={handleSwapDirection}
              className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To panel */}
          <div className="bg-zinc-800/60 rounded-xl p-4">
            <label htmlFor="to-token" className="text-xs font-medium text-zinc-400 block mb-3">
              To
            </label>
            {isLoadingTokens ? (
              <div className="h-10 bg-zinc-700/50 rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <TokenSelect
                  id="to-token"
                  tokens={tokens}
                  value={toCurrency}
                  onChange={setToCurrency}
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor="receive" className="sr-only">Amount to receive</label>
                  <input
                    id="receive"
                    type="text"
                    readOnly
                    placeholder="0.00"
                    value={receiveAmount !== null ? fmt(receiveAmount) : ''}
                    className="w-full bg-transparent text-zinc-300 text-2xl font-semibold text-right outline-none placeholder:text-zinc-600 cursor-default"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Exchange rate */}
          {rate !== null && fromCurrency && toCurrency && (
            <p className="text-xs text-zinc-500 text-center py-0.5">
              1 {fromCurrency} ≈ {fmt(rate)} {toCurrency}
            </p>
          )}

          {/* Validation error */}
          {amountError && (
            <div className="flex items-center gap-1.5 px-1">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p role="alert" className="text-sm text-red-400">{amountError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl font-semibold text-white text-sm tracking-wide transition-all bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] mt-1"
          >
            {status === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirming...
              </span>
            ) : (
              'CONFIRM SWAP'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
