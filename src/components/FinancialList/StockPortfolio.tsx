import { useState } from 'react'
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency } from '../../utils/currency'
import { fetchMultipleQuotes, fetchStockQuote } from '../../utils/stockPrice'
import type { StockPosition } from '../../types'
import { CURRENCIES } from '../../types'
import { Modal, FormField, inputClass } from './TransactionForm'

type FetchState = 'idle' | 'loading' | 'done'

export default function StockPortfolio({ currency }: { currency: string }) {
  const { stockPositions, updateStockPosition, deleteStockPosition } = useFinanceStore()
  const [showForm, setShowForm] = useState(false)
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({})

  const totalCost = stockPositions.reduce((s, p) => s + p.shares * p.avgCost, 0)
  const totalValue = stockPositions.reduce((s, p) => {
    const price = p.currentPrice ?? p.avgCost
    return s + p.shares * price
  }, 0)
  const totalPnL = totalValue - totalCost
  const hasPrices = stockPositions.some((p) => p.currentPrice !== undefined)

  const handleRefreshAll = async () => {
    if (stockPositions.length === 0) return
    setFetchState('loading')
    setFetchErrors({})
    const errors: Record<string, string> = {}

    await fetchMultipleQuotes(
      stockPositions.map((p) => p.symbol),
      (symbol, quote) => {
        const pos = stockPositions.find((p) => p.symbol === symbol)
        if (pos) {
          updateStockPosition(pos.id, {
            currentPrice: quote.price,
            currentCurrency: quote.currency,
            lastUpdated: new Date().toISOString(),
          })
        }
      },
      (symbol, error) => { errors[symbol] = error }
    )

    setFetchErrors(errors)
    setFetchState('done')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          {hasPrices && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              市值 {formatCurrency(totalValue, currency)}
              <span className={`ml-2 font-medium ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL, currency)}
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={fetchState === 'loading' || stockPositions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-600
                       text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={fetchState === 'loading' ? 'animate-spin' : ''} />
            更新股價
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> 新增持股
          </button>
        </div>
      </div>

      {/* Fetch errors */}
      {Object.keys(fetchErrors).length > 0 && (
        <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle size={14} className="text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">部分股票無法取得股價</span>
          </div>
          {Object.entries(fetchErrors).map(([sym, err]) => (
            <p key={sym} className="text-xs text-yellow-600 dark:text-yellow-500">
              {sym}：{err}（請確認代號格式，台股加 .TW，如 2330.TW）
            </p>
          ))}
        </div>
      )}

      {/* Stock list */}
      {stockPositions.length === 0 ? (
        <div className="py-12 text-center text-gray-400 dark:text-gray-600 text-sm">
          <p>尚無持股，點擊新增持股開始追蹤</p>
          <p className="text-xs mt-1">台股格式：2330.TW　美股格式：AAPL</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stockPositions.map((pos) => (
            <StockItem
              key={pos.id}
              pos={pos}
              onDelete={() => deleteStockPosition(pos.id)}
              onRefresh={async () => {
                try {
                  const quote = await fetchStockQuote(pos.symbol)
                  updateStockPosition(pos.id, {
                    currentPrice: quote.price,
                    currentCurrency: quote.currency,
                    lastUpdated: new Date().toISOString(),
                  })
                  setFetchErrors((prev) => { const next = { ...prev }; delete next[pos.symbol]; return next })
                } catch (e) {
                  setFetchErrors((prev) => ({ ...prev, [pos.symbol]: (e as Error).message }))
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {stockPositions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">總成本</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(totalCost, currency)}</span>
        </div>
      )}

      {showForm && <StockForm onClose={() => setShowForm(false)} />}
    </div>
  )
}

/** Annualized return (CAGR) given total return and holding period in days */
function calcCAGR(avgCost: number, currentPrice: number, purchaseDate?: string): number | null {
  if (!purchaseDate || avgCost <= 0 || currentPrice <= 0) return null
  const days = (Date.now() - new Date(purchaseDate).getTime()) / 86_400_000
  if (days < 1) return null
  const years = days / 365
  return (Math.pow(currentPrice / avgCost, 1 / years) - 1) * 100
}

function StockItem({
  pos, onDelete, onRefresh,
}: {
  pos: StockPosition
  onDelete: () => void
  onRefresh: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = useState(false)
  const currentPrice = pos.currentPrice ?? pos.avgCost
  const currentValue = pos.shares * currentPrice
  const cost = pos.shares * pos.avgCost
  const pnl = currentValue - cost
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
  const isUp = pnl >= 0
  const cagr = pos.currentPrice !== undefined
    ? calcCAGR(pos.avgCost, pos.currentPrice, pos.purchaseDate)
    : null

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
        {isUp
          ? <TrendingUp size={16} className="text-purple-600" />
          : <TrendingDown size={16} className="text-red-500" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{pos.symbol}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{pos.name}</span>
          {cagr !== null && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
              cagr >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-500'
            }`}>
              年化 {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {pos.shares} 股 × 均價 {formatCurrency(pos.avgCost, pos.currency)}
          {pos.purchaseDate && <span className="ml-1">· 買入 {pos.purchaseDate}</span>}
          {pos.lastUpdated && (
            <span className="ml-1">
              · 更新 {new Date(pos.lastUpdated).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>

      {/* Value & P&L */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatCurrency(currentValue, pos.currentCurrency ?? pos.currency)}
        </p>
        {pos.currentPrice !== undefined && (
          <p className={`text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '+' : ''}{formatCurrency(pnl, pos.currency)} ({pnlPct.toFixed(1)}%)
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function StockForm({ onClose }: { onClose: () => void }) {
  const { addStockPosition, updateStockPosition, stockPositions, settings } = useFinanceStore()
  const [form, setForm] = useState({
    symbol: '',
    name: '',
    shares: '',
    avgCost: '',
    currency: settings.currency,
    purchaseDate: new Date().toISOString().split('T')[0],
  })
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const handleLookup = async () => {
    if (!form.symbol) return
    setFetching(true)
    setFetchError('')
    try {
      const quote = await fetchStockQuote(form.symbol.trim().toUpperCase())
      setForm((f) => ({
        ...f,
        symbol: quote.symbol,
        name: quote.name ?? f.name,
        currency: quote.currency,
      }))
      // Pre-fill current price into existing position if exists
      const existing = stockPositions.find((p) => p.symbol === quote.symbol)
      if (existing) {
        updateStockPosition(existing.id, {
          currentPrice: quote.price,
          currentCurrency: quote.currency,
          lastUpdated: new Date().toISOString(),
        })
      }
    } catch (e) {
      setFetchError(`查詢失敗：${(e as Error).message}`)
    }
    setFetching(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.symbol || !form.shares || !form.avgCost) return
    addStockPosition({
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name,
      shares: parseFloat(form.shares),
      avgCost: parseFloat(form.avgCost),
      currency: form.currency,
      purchaseDate: form.purchaseDate || undefined,
    })
    onClose()
  }

  return (
    <Modal title="新增持股" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Symbol with lookup */}
        <FormField label="股票代號">
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              className={inputClass + ' uppercase'}
              placeholder="2330.TW 或 AAPL"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={fetching || !form.symbol}
              className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                         text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {fetching ? '查詢中…' : '查詢'}
            </button>
          </div>
          {fetchError && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
          <p className="text-xs text-gray-400 mt-1">台股：2330.TW　美股：AAPL　ETF：0050.TW</p>
        </FormField>

        <FormField label="股票名稱（選填）">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
            placeholder="例：台積電"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="持股數量（股）">
            <input
              type="number"
              required
              min="0"
              step="any"
              value={form.shares}
              onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))}
              className={inputClass}
              placeholder="1000"
            />
          </FormField>
          <FormField label="平均成本">
            <input
              type="number"
              required
              min="0"
              step="any"
              value={form.avgCost}
              onChange={(e) => setForm((f) => ({ ...f, avgCost: e.target.value }))}
              className={inputClass}
              placeholder="0"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="幣別">
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="買入日期">
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
              className={inputClass}
            />
          </FormField>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          新增
        </button>
      </form>
    </Modal>
  )
}
