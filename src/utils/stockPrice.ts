export interface StockQuote {
  symbol: string
  price: number
  currency: string
  name?: string
  change?: number
  changePercent?: number
}

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
// corsproxy.io — free, no-key CORS proxy
const CORS_PROXY = 'https://corsproxy.io/?url='

/** Try a URL directly; on CORS/network error retry through proxy */
async function fetchJSON(url: string): Promise<unknown> {
  // 1. Direct request
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    })
    if (res.ok) return res.json()
  } catch {
    // likely CORS — fall through to proxy
  }

  // 2. CORS proxy fallback
  const proxied = CORS_PROXY + encodeURIComponent(url)
  const res = await fetch(proxied, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await fetchJSON(url)) as any

  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('查無資料')

  const meta = result.meta
  const price: number = meta.regularMarketPrice ?? meta.chartPreviousClose
  if (!price) throw new Error('無法取得股價')

  const prevClose: number = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change = price - prevClose
  const changePercent = prevClose ? (change / prevClose) * 100 : 0

  return {
    symbol: meta.symbol ?? symbol,
    price,
    currency: meta.currency ?? 'USD',
    name: meta.longName ?? meta.shortName,
    change,
    changePercent,
  }
}

export async function fetchMultipleQuotes(
  symbols: string[],
  onUpdate: (symbol: string, quote: StockQuote) => void,
  onError: (symbol: string, error: string) => void
): Promise<number> {
  let successCount = 0
  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const quote = await fetchStockQuote(symbol)
        onUpdate(symbol, quote)
        successCount++
      } catch (e) {
        onError(symbol, (e as Error).message)
      }
    })
  )
  return successCount
}
