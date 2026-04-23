/** Exchange rates with USD as base (1 USD = N units) */
export type Rates = Record<string, number>

const CACHE_KEY = 'fx_rates_cache'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

interface CacheEntry {
  rates: Rates
  base: string
  fetchedAt: number
}

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

function saveCache(entry: CacheEntry) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)) } catch { /* ignore */ }
}

/** Fetch exchange rates (base = USD). Falls back to cached data on failure. */
export async function fetchExchangeRates(): Promise<Rates> {
  const cached = loadCache()
  if (cached) return cached.rates

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.rates) throw new Error('no rates')
    saveCache({ rates: data.rates, base: 'USD', fetchedAt: Date.now() })
    return data.rates
  } catch {
    // Return fallback rates (rough estimates) so the app still works offline
    return FALLBACK_RATES
  }
}

/**
 * Convert an amount from one currency to another.
 * @param rates - USD-based rates (1 USD = N units)
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Rates
): number {
  if (from === to) return amount
  // amount (from) → USD → to
  const inUSD = from === 'USD' ? amount : amount / (rates[from] ?? 1)
  return to === 'USD' ? inUSD : inUSD * (rates[to] ?? 1)
}

// Rough static fallback (used only when offline and no cache)
const FALLBACK_RATES: Rates = {
  USD: 1,
  TWD: 32.5,
  EUR: 0.92,
  JPY: 154,
  GBP: 0.79,
  CNY: 7.24,
  HKD: 7.83,
  SGD: 1.35,
}
