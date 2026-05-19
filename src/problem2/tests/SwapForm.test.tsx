import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import SwapForm from '../app/components/SwapForm'

const mockPrices = [
  { currency: 'BTC', date: '2023-08-30T00:00:00.000Z', price: 26000 },
  { currency: 'ETH', date: '2023-08-30T00:00:00.000Z', price: 1750 },
  { currency: 'USDC', date: '2023-08-30T00:00:00.000Z', price: 1 },
]

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => mockPrices }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('SwapForm', () => {
  describe('TDD-4: initial render', () => {
    it('shows two token selectors with a default pair after prices load', async () => {
      mockFetch()
      render(<SwapForm />)

      const fromSelect = await screen.findByLabelText('From')
      const toSelect = screen.getByLabelText('To')

      expect(fromSelect).toHaveValue('BTC')
      expect(toSelect).toHaveValue('ETH')
    })
  })

  describe('TDD-5: amount → receive', () => {
    beforeEach(() => mockFetch())

    it('displays computed receive amount when a valid amount is entered', async () => {
      render(<SwapForm />)
      await screen.findByLabelText('From')

      const amountInput = screen.getByLabelText('Amount to send')
      await userEvent.type(amountInput, '1')

      // 1 BTC @ 26000 / ETH @ 1750 ≈ 14.857...
      const receiveInput = screen.getByLabelText('Amount to receive')
      await waitFor(() =>
        expect(receiveInput).not.toHaveValue(''),
      )
      const value = parseFloat((receiveInput as HTMLInputElement).value)
      expect(value).toBeCloseTo(26000 / 1750, 2)
    })
  })

  describe('TDD-6: changing "to" token recomputes', () => {
    beforeEach(() => mockFetch())

    it('updates receive amount when the "to" token changes', async () => {
      render(<SwapForm />)
      await screen.findByLabelText('From')

      await userEvent.type(screen.getByLabelText('Amount to send'), '1')
      const toSelect = screen.getByLabelText('To')
      await userEvent.selectOptions(toSelect, 'USDC')

      const receiveInput = screen.getByLabelText('Amount to receive')
      await waitFor(() => {
        const value = parseFloat((receiveInput as HTMLInputElement).value)
        expect(value).toBeCloseTo(26000, 0) // 1 BTC → USDC @ $1 each
      })
    })
  })

  describe('TDD-7: swap-direction button', () => {
    beforeEach(() => mockFetch())

    it('swaps from/to tokens when the swap button is clicked', async () => {
      render(<SwapForm />)
      await screen.findByLabelText('From')

      await userEvent.click(screen.getByRole('button', { name: /swap direction/i }))

      expect(screen.getByLabelText('From')).toHaveValue('ETH')
      expect(screen.getByLabelText('To')).toHaveValue('BTC')
    })
  })

  describe('TDD-8: validation', () => {
    beforeEach(() => mockFetch())

    it('shows an error and disables submit when amount is invalid', async () => {
      render(<SwapForm />)
      await screen.findByLabelText('From')

      await userEvent.type(screen.getByLabelText('Amount to send'), '-5')

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm swap/i })).toBeDisabled()
    })
  })

  describe('TDD-9: submit flow', () => {
    beforeEach(() => mockFetch())

    it('shows loading state then success message after submit', async () => {
      render(<SwapForm submitDelay={50} />)
      await screen.findByLabelText('From')

      await userEvent.type(screen.getByLabelText('Amount to send'), '1')
      const submitBtn = screen.getByRole('button', { name: /confirm swap/i })
      await userEvent.click(submitBtn)

      expect(submitBtn).toBeDisabled()
      expect(submitBtn).toHaveTextContent(/loading|confirming/i)

      await screen.findByText(/swap confirmed/i, { timeout: 500 })
    })
  })
})
