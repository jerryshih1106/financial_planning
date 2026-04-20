import { CURRENCIES } from '../types'

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  const formatted = new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return `${symbol}${formatted}`
}

export function formatLargeNumber(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  if (Math.abs(amount) >= 100_000_000) {
    return `${symbol}${(amount / 100_000_000).toFixed(2)}億`
  }
  if (Math.abs(amount) >= 10_000) {
    return `${symbol}${(amount / 10_000).toFixed(1)}萬`
  }
  return formatCurrency(amount, currencyCode)
}
