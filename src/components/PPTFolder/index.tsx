import { useState, useRef } from 'react'
import {
  FolderOpen, FileText, Trash2, Upload, Check,
  ChevronDown, ChevronRight, AlertCircle, Loader2, Plus,
} from 'lucide-react'
import { parseFile, toAsset, toStockPosition } from '../../utils/pptxParser'
import type { PPTParseResult, ExtractedAsset, ExtractedStock, ExtractedTransaction } from '../../utils/pptxParser'
import { useFinanceStore } from '../../store/useFinanceStore'
import { CURRENCIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../types'

const inputCls = 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

// ── Row editors ───────────────────────────────────────────────────────────────

function TransactionRow({ item, onChange, onRemove }: {
  item: ExtractedTransaction
  onChange: (u: ExtractedTransaction) => void
  onRemove: () => void
}) {
  const categories = item.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 text-xs">
      <td className="py-1.5 pr-2 w-28">
        <input type="date" value={item.date} onChange={(e) => onChange({ ...item, date: e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-20">
        <select value={item.type} onChange={(e) => onChange({ ...item, type: e.target.value as 'income' | 'expense' })} className={inputCls}>
          <option value="expense">支出</option>
          <option value="income">存入</option>
        </select>
      </td>
      <td className="py-1.5 pr-2">
        <input value={item.description} onChange={(e) => onChange({ ...item, description: e.target.value })} className={inputCls} placeholder="摘要" />
      </td>
      <td className="py-1.5 pr-2 w-24">
        <select value={item.category} onChange={(e) => onChange({ ...item, category: e.target.value })} className={inputCls}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-1.5 pr-2 w-28">
        <input type="number" value={item.amount} onChange={(e) => onChange({ ...item, amount: +e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-20">
        <select value={item.currency} onChange={(e) => onChange({ ...item, currency: e.target.value })} className={inputCls}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </td>
      <td className="py-1.5 w-8 text-center">
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

function AssetRow({ item, onChange, onRemove }: {
  item: ExtractedAsset
  onChange: (u: ExtractedAsset) => void
  onRemove: () => void
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 text-xs">
      <td className="py-1.5 pr-2">
        <input value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-28">
        <input type="number" value={item.value} onChange={(e) => onChange({ ...item, value: +e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-20">
        <select value={item.currency} onChange={(e) => onChange({ ...item, currency: e.target.value })} className={inputCls}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </td>
      <td className="py-1.5 pr-2 w-28">
        <select value={item.type} onChange={(e) => onChange({ ...item, type: e.target.value as ExtractedAsset['type'] })} className={inputCls}>
          <option value="cash">現金/存款</option>
          <option value="investment">股票/基金</option>
          <option value="property">房產</option>
          <option value="other">其他</option>
        </select>
      </td>
      <td className="py-1.5 w-8 text-center">
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

function StockRow({ item, onChange, onRemove }: {
  item: ExtractedStock
  onChange: (u: ExtractedStock) => void
  onRemove: () => void
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 text-xs">
      <td className="py-1.5 pr-2 w-20">
        <input value={item.symbol} onChange={(e) => onChange({ ...item, symbol: e.target.value.toUpperCase() })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2">
        <input value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-20">
        <input type="number" value={item.shares} onChange={(e) => onChange({ ...item, shares: +e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-24">
        <input type="number" value={item.avgCost} onChange={(e) => onChange({ ...item, avgCost: +e.target.value })} className={inputCls} />
      </td>
      <td className="py-1.5 pr-2 w-20">
        <select value={item.currency} onChange={(e) => onChange({ ...item, currency: e.target.value })} className={inputCls}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </td>
      <td className="py-1.5 pr-2 w-28">
        <input type="date" value={item.purchaseDate ?? ''} onChange={(e) => onChange({ ...item, purchaseDate: e.target.value || undefined })} className={inputCls} />
      </td>
      <td className="py-1.5 w-8 text-center">
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {title} <span className="font-normal normal-case text-gray-400">({count} 筆)</span>
      </button>
      {open && children}
    </div>
  )
}

// ── File card ─────────────────────────────────────────────────────────────────

function FileCard({ result, onDismiss }: { result: PPTParseResult; onDismiss: () => void }) {
  const [txs, setTxs] = useState<ExtractedTransaction[]>(result.transactions)
  const [assets, setAssets] = useState<ExtractedAsset[]>(result.assets)
  const [stocks, setStocks] = useState<ExtractedStock[]>(result.stocks)
  const [expanded, setExpanded] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const [imported, setImported] = useState(false)
  const { addTransaction, addAsset, addStockPosition } = useFinanceStore()

  const total = txs.length + assets.length + stocks.length
  const isEmpty = total === 0

  const handleImport = () => {
    txs.forEach((t) => addTransaction({
      type: t.type, category: t.category, amount: t.amount,
      currency: t.currency, date: t.date, description: t.description,
    }))
    assets.forEach((a) => addAsset(toAsset(a)))
    stocks.forEach((s) => addStockPosition(toStockPosition(s)))
    setImported(true)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <FileText size={18} className="text-orange-500 flex-shrink-0" />
        <span className="font-medium text-gray-900 dark:text-white text-sm flex-1 truncate">{result.fileName}</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{result.slides.length} 頁</span>
          {txs.length > 0 && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">{txs.length} 筆交易</span>}
          {assets.length > 0 && <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">{assets.length} 筆資產</span>}
          {stocks.length > 0 && <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">{stocks.length} 支股票</span>}
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <button onClick={onDismiss} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-5">
          {/* Always show debug info */}
          <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/40 rounded-lg px-3 py-2 font-mono">
            {result.debugInfo}
          </div>

          {isEmpty && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
              <AlertCircle size={16} />
              <span>未偵測到資料。請確認 PDF 包含「日期、摘要、支出/存入」等欄位，或查看原始文字確認內容。</span>
            </div>
          )}

          {/* Transactions */}
          {txs.length > 0 && (
            <Section title="收支交易" count={txs.length}>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                      <th className="text-left px-3 py-2 font-medium">日期</th>
                      <th className="text-left px-3 py-2 font-medium">類型</th>
                      <th className="text-left px-3 py-2 font-medium">摘要</th>
                      <th className="text-left px-3 py-2 font-medium">類別</th>
                      <th className="text-left px-3 py-2 font-medium">金額</th>
                      <th className="text-left px-3 py-2 font-medium">幣別</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t) => (
                      <TransactionRow
                        key={t.id} item={t}
                        onChange={(u) => setTxs((prev) => prev.map((x) => x.id === t.id ? u : x))}
                        onRemove={() => setTxs((prev) => prev.filter((x) => x.id !== t.id))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Assets */}
          {assets.length > 0 && (
            <Section title="資產" count={assets.length}>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                      <th className="text-left px-3 py-2 font-medium">名稱</th>
                      <th className="text-left px-3 py-2 font-medium">金額</th>
                      <th className="text-left px-3 py-2 font-medium">幣別</th>
                      <th className="text-left px-3 py-2 font-medium">類型</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <AssetRow
                        key={a.id} item={a}
                        onChange={(u) => setAssets((prev) => prev.map((x) => x.id === a.id ? u : x))}
                        onRemove={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Stocks */}
          {stocks.length > 0 && (
            <Section title="股票持倉" count={stocks.length}>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                      <th className="text-left px-3 py-2 font-medium">代號</th>
                      <th className="text-left px-3 py-2 font-medium">名稱</th>
                      <th className="text-left px-3 py-2 font-medium">股數</th>
                      <th className="text-left px-3 py-2 font-medium">均價</th>
                      <th className="text-left px-3 py-2 font-medium">幣別</th>
                      <th className="text-left px-3 py-2 font-medium">買入日期</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((s) => (
                      <StockRow
                        key={s.id} item={s}
                        onChange={(u) => setStocks((prev) => prev.map((x) => x.id === s.id ? u : x))}
                        onRemove={() => setStocks((prev) => prev.filter((x) => x.id !== s.id))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Raw text */}
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
          >
            {showRaw ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            查看原始文字 ({result.rawText.split('\n').filter(Boolean).length} 行)
          </button>
          {showRaw && (
            <pre className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 overflow-x-auto max-h-64 whitespace-pre-wrap font-mono leading-relaxed">
              {result.rawText || '(無文字內容)'}
            </pre>
          )}

          {/* Import button */}
          {!isEmpty && (
            <div className="flex justify-end pt-1">
              {imported ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                  <Check size={16} /> 已匯入
                </div>
              ) : (
                <button
                  onClick={handleImport}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  <Plus size={16} />
                  匯入 {total} 筆至帳本
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PPTFolder() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<PPTParseResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setLoading(true)
    setError(null)
    const newResults: PPTParseResult[] = []
    for (const file of Array.from(files)) {
      if (!/\.(pptx?|pdf)$/i.test(file.name)) {
        setError(`不支援的格式：${file.name}（支援 .pptx / .pdf）`)
        continue
      }
      try {
        const result = await parseFile(file)
        newResults.push(result)
      } catch (e) {
        setError(`解析失敗：${file.name} — ${(e as Error).message}`)
      }
    }
    setResults((prev) => [...newResults, ...prev])
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <FolderOpen size={20} />
          <span className="font-semibold">資產 PPT / PDF 資料夾</span>
        </div>
        <p className="text-orange-100 text-sm">上傳含資產清單或銀行對帳單的 PPTX / PDF 檔案，自動解析並轉為可匯入格式。</p>
      </div>

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 size={32} className="text-orange-500 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">解析中…</p>
          </>
        ) : (
          <>
            <Upload size={32} className="text-gray-400 dark:text-gray-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">拖曳或點擊上傳 .pptx / .pdf 檔案</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">支援多檔案同時上傳</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pptx,.ppt,.pdf" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p className="font-medium text-gray-700 dark:text-gray-300">支援格式</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><span className="font-medium text-gray-600 dark:text-gray-300">銀行對帳單 PDF</span>：自動識別「日期、摘要、支出、存入、結餘」欄位 → 轉為收支記錄</li>
            <li><span className="font-medium text-gray-600 dark:text-gray-300">資產清單 PDF/PPTX</span>：偵測金額（NT$500,000）→ 資產記錄</li>
            <li><span className="font-medium text-gray-600 dark:text-gray-300">股票持倉 PDF/PPTX</span>：偵測股票代號（2330、AAPL）→ 持倉記錄</li>
            <li>支援民國年（113/01/15）自動換算為西元年</li>
          </ul>
        </div>
      )}

      {results.map((r, i) => (
        <FileCard
          key={`${r.fileName}_${i}`}
          result={r}
          onDismiss={() => setResults((prev) => prev.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  )
}
