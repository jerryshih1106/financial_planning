import { useRef, useState } from 'react'
import { X, Upload, Download, FileJson, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useFinanceStore } from '../../store/useFinanceStore'
import {
  exportToJSON, exportToCSV, exportToXLSX,
  parseJSON, parseCSV, parseSpreadsheet,
  type BackupData,
} from '../../utils/importExport'
import type { Transaction, Asset, Liability } from '../../types'

type Status = { type: 'success' | 'error'; message: string } | null

// File types accepted for spreadsheet import
const SPREADSHEET_ACCEPT = '.xlsx,.xls,.ods,.numbers'

export default function ImportExportModal({ onClose }: { onClose: () => void }) {
  const store = useFinanceStore()
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const sheetInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>(null)
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge')

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportJSON = () => {
    exportToJSON(buildBackup())
    setStatus({ type: 'success', message: 'JSON 備份已下載' })
  }

  const handleExportCSV = () => {
    if (store.transactions.length === 0) {
      setStatus({ type: 'error', message: '尚無收支記錄可匯出' }); return
    }
    exportToCSV(store.transactions)
    setStatus({ type: 'success', message: 'CSV 已下載' })
  }

  const handleExportXLSX = () => {
    exportToXLSX(buildBackup())
    setStatus({ type: 'success', message: 'Excel 檔案已下載（含收支、資產、負債三個工作表）' })
  }

  // ── Import ────────────────────────────────────────────────────────────────

  const handleJSONFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = parseJSON(text)
      applyImport(data)
      const count = data.transactions.length + data.assets.length + data.liabilities.length
      setStatus({ type: 'success', message: `成功匯入 ${count} 筆資料` })
    } catch (err) {
      setStatus({ type: 'error', message: `JSON 匯入失敗：${(err as Error).message}` })
    }
    e.target.value = ''
  }

  const handleCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (mergeMode === 'replace') {
        store.transactions.forEach((t) => store.deleteTransaction(t.id))
      }
      rows.forEach((row) => store.addTransaction(row))
      setStatus({ type: 'success', message: `成功匯入 ${rows.length} 筆交易記錄` })
    } catch (err) {
      setStatus({ type: 'error', message: `CSV 匯入失敗：${(err as Error).message}` })
    }
    e.target.value = ''
  }

  const handleSpreadsheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const data = parseSpreadsheet(buffer)
      applyImport(data)
      const count = data.transactions.length + data.assets.length + data.liabilities.length
      const ext = file.name.split('.').pop()?.toUpperCase() ?? '試算表'
      setStatus({ type: 'success', message: `${ext} 成功匯入 ${count} 筆資料` })
    } catch (err) {
      setStatus({ type: 'error', message: `試算表匯入失敗：${(err as Error).message}` })
    }
    e.target.value = ''
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const buildBackup = (): BackupData => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: store.transactions,
    assets: store.assets,
    liabilities: store.liabilities,
  })

  const applyImport = (data: BackupData) => {
    if (mergeMode === 'replace') {
      store.transactions.forEach((t) => store.deleteTransaction(t.id))
      store.assets.forEach((a) => store.deleteAsset(a.id))
      store.liabilities.forEach((l) => store.deleteLiability(l.id))
    }
    data.transactions.forEach((t: Transaction) => {
      const { id: _id, ...rest } = t; void _id
      store.addTransaction({ ...rest, id: uuidv4() } as Omit<Transaction, 'id'>)
    })
    data.assets.forEach((a: Asset) => {
      const { id: _id, ...rest } = a; void _id
      store.addAsset({ ...rest, id: uuidv4() } as Omit<Asset, 'id'>)
    })
    data.liabilities.forEach((l: Liability) => {
      const { id: _id, ...rest } = l; void _id
      store.addLiability({ ...rest, id: uuidv4() } as Omit<Liability, 'id'>)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">匯入 / 匯出資料</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Status */}
          {status && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
              status.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}>
              {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{status.message}</span>
            </div>
          )}

          {/* ── Export ── */}
          <Section title="匯出" icon={<Download size={16} />}>
            <div className="grid grid-cols-3 gap-3">
              <ExportButton
                icon={<FileJson size={18} className="text-blue-500" />}
                label="JSON"
                sub="完整備份"
                onClick={handleExportJSON}
              />
              <ExportButton
                icon={<FileSpreadsheet size={18} className="text-green-600" />}
                label="XLSX"
                sub="Excel 多工作表"
                onClick={handleExportXLSX}
                badge="推薦"
              />
              <ExportButton
                icon={<FileSpreadsheet size={18} className="text-teal-500" />}
                label="CSV"
                sub="收支記錄"
                onClick={handleExportCSV}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              XLSX 包含收支、資產、負債三個工作表，可直接用 Excel / Google Sheets 開啟編輯
            </p>
          </Section>

          {/* ── Import ── */}
          <Section title="匯入" icon={<Upload size={16} />}>
            {/* Merge Mode Toggle */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">匯入方式：</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 text-xs flex-1">
                <button
                  onClick={() => setMergeMode('merge')}
                  className={`flex-1 px-3 py-2 font-medium transition-colors ${
                    mergeMode === 'merge'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  合併（保留現有）
                </button>
                <button
                  onClick={() => setMergeMode('replace')}
                  className={`flex-1 px-3 py-2 font-medium transition-colors ${
                    mergeMode === 'replace'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  覆蓋（清除後匯入）
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ImportButton
                icon={<FileSpreadsheet size={18} className="text-green-600" />}
                label="XLSX / XLS"
                sub="Excel 試算表"
                accept={SPREADSHEET_ACCEPT}
                inputRef={sheetInputRef}
                onChange={handleSpreadsheetFile}
                badge="推薦"
              />
              <ImportButton
                icon={<FileJson size={18} className="text-blue-500" />}
                label="JSON"
                sub="完整備份"
                accept=".json"
                inputRef={jsonInputRef}
                onChange={handleJSONFile}
              />
              <ImportButton
                icon={<FileSpreadsheet size={18} className="text-teal-500" />}
                label="CSV"
                sub="收支記錄"
                accept=".csv"
                inputRef={csvInputRef}
                onChange={handleCSVFile}
              />
            </div>

            {/* Supported formats note */}
            <div className="mt-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">支援格式：</span>
                .xlsx、.xls（Microsoft Excel）、.ods（LibreOffice）、.json、.csv
              </p>
            </div>

            {/* CSV Format Hint */}
            <details className="mt-2">
              <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
                CSV 格式說明
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">必要欄位（第一行為 header）：</p>
                <code className="text-xs text-gray-600 dark:text-gray-300 block">
                  type,category,amount,currency,date,description
                </code>
                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">範例：</p>
                <code className="text-xs text-gray-600 dark:text-gray-300 block whitespace-pre">{`expense,餐飲,500,TWD,2026-04-01,午餐
income,薪資,50000,TWD,2026-04-01,四月薪資`}</code>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  type：<code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">income</code> 或 <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">expense</code>
                </p>
              </div>
            </details>
          </Section>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function ExportButton({ icon, label, sub, onClick, badge }: {
  icon: React.ReactNode; label: string; sub: string; onClick: () => void; badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed
                 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500
                 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-center group"
    >
      {badge && (
        <span className="absolute -top-2 -right-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
          {badge}
        </span>
      )}
      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center
                      group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
      </div>
    </button>
  )
}

function ImportButton({ icon, label, sub, accept, inputRef, onChange, badge }: {
  icon: React.ReactNode; label: string; sub: string; accept: string; badge?: string
  inputRef: React.RefObject<HTMLInputElement>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <button
      onClick={() => inputRef.current?.click()}
      className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed
                 border-gray-200 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500
                 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors text-center group"
    >
      {badge && (
        <span className="absolute -top-2 -right-2 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-medium">
          {badge}
        </span>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={onChange} className="hidden" />
      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center
                      group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
      </div>
    </button>
  )
}
