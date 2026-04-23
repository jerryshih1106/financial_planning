import { useFinanceStore } from '../store/useFinanceStore'
import { convertCurrency } from '../utils/exchangeRate'

/**
 * Returns a `toDisplay(amount, fromCurrency)` function that converts any
 * currency into the user's current display currency using live exchange rates.
 */
export function useConvert() {
  const { exchangeRates, settings } = useFinanceStore()
  const displayCurrency = settings.currency

  function toDisplay(amount: number, fromCurrency: string): number {
    if (!isFinite(amount) || isNaN(amount)) return 0
    return convertCurrency(amount, fromCurrency, displayCurrency, exchangeRates)
  }

  return { toDisplay, displayCurrency }
}

/** Sum assets/liabilities/stocks converted to display currency */
export function useTotalAssets() {
  const { assets, liabilities, stockPositions } = useFinanceStore()
  const { toDisplay } = useConvert()

  const totalManualAssets = assets.reduce((s, a) => s + toDisplay(a.value, a.currency), 0)
  const totalStockValue   = stockPositions.reduce((s, p) => {
    const price = p.currentPrice ?? p.avgCost
    const cur   = p.currentPrice !== undefined ? (p.currentCurrency ?? p.currency) : p.currency
    return s + toDisplay(p.shares * price, cur)
  }, 0)
  const totalAssets      = totalManualAssets + totalStockValue
  const totalLiabilities = liabilities.reduce((s, l) => s + toDisplay(l.amount, l.currency), 0)
  const netWorth         = totalAssets - totalLiabilities

  return { totalManualAssets, totalStockValue, totalAssets, totalLiabilities, netWorth }
}
