import * as XLSX from 'xlsx'
import type { Transaction, Asset, Liability } from '../types'

// ── JSON ──────────────────────────────────────────────────────────────────────

export interface BackupData {
  version: number
  exportedAt: string
  transactions: Transaction[]
  assets: Asset[]
  liabilities: Liability[]
}

export function exportToJSON(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `financial-backup-${formatDateForFilename()}.json`)
}

export function parseJSON(text: string): BackupData {
  const parsed = JSON.parse(text)
  if (!parsed.version || !Array.isArray(parsed.transactions)) {
    throw new Error('格式不正確：缺少必要欄位')
  }
  return parsed as BackupData
}

// ── CSV ───────────────────────────────────────────────────────────────────────

const TX_HEADERS = ['type', 'category', 'amount', 'currency', 'date', 'description']

export function exportToCSV(transactions: Transaction[]): void {
  const rows = [
    TX_HEADERS.join(','),
    ...transactions.map((t) =>
      [t.type, t.category, t.amount, t.currency, t.date, `"${(t.description ?? '').replace(/"/g, '""')}"`].join(',')
    ),
  ]
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `transactions-${formatDateForFilename()}.csv`)
}

// ── XLSX ──────────────────────────────────────────────────────────────────────

/** 匯出：三個 Sheet（收支、資產、負債） */
export function exportToXLSX(data: BackupData): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1 — 收支記錄
  const txRows = data.transactions.map((t) => ({
    類型: t.type === 'income' ? '收入' : '支出',
    類別: t.category,
    金額: t.amount,
    幣別: t.currency,
    日期: t.date,
    備註: t.description ?? '',
    // Keep raw type for re-import
    _type: t.type,
  }))
  const txSheet = XLSX.utils.json_to_sheet(
    txRows.length > 0 ? txRows : [{ 類型: '', 類別: '', 金額: '', 幣別: '', 日期: '', 備註: '', _type: '' }]
  )
  setColWidths(txSheet, [8, 10, 12, 8, 12, 20, 10])
  XLSX.utils.book_append_sheet(wb, txSheet, '收支記錄')

  // Sheet 2 — 資產
  const assetTypeLabel: Record<string, string> = {
    cash: '現金/存款', investment: '股票/基金', property: '房產', other: '其他',
  }
  const assetRows = data.assets.map((a) => ({
    名稱: a.name,
    市值: a.value,
    幣別: a.currency,
    類型: assetTypeLabel[a.type] ?? a.type,
    年化報酬率: a.annualReturn ?? '',
    _type: a.type,
  }))
  const assetSheet = XLSX.utils.json_to_sheet(
    assetRows.length > 0 ? assetRows : [{ 名稱: '', 市值: '', 幣別: '', 類型: '', 年化報酬率: '', _type: '' }]
  )
  setColWidths(assetSheet, [20, 14, 8, 12, 14, 12])
  XLSX.utils.book_append_sheet(wb, assetSheet, '資產')

  // Sheet 3 — 負債
  const liabilityTypeLabel: Record<string, string> = {
    loan: '個人貸款', mortgage: '房貸', credit: '信用卡', other: '其他',
  }
  const liabilityRows = data.liabilities.map((l) => ({
    名稱: l.name,
    餘額: l.amount,
    幣別: l.currency,
    類型: liabilityTypeLabel[l.type] ?? l.type,
    年利率: l.interestRate ?? '',
    _type: l.type,
  }))
  const liabilitySheet = XLSX.utils.json_to_sheet(
    liabilityRows.length > 0 ? liabilityRows : [{ 名稱: '', 餘額: '', 幣別: '', 類型: '', 年利率: '', _type: '' }]
  )
  setColWidths(liabilitySheet, [20, 14, 8, 12, 10, 12])
  XLSX.utils.book_append_sheet(wb, liabilitySheet, '負債')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, `financial-${formatDateForFilename()}.xlsx`)
}

/** 匯入 XLSX / XLS / ODS：自動解析所有支援的 Sheet */
export function parseSpreadsheet(buffer: ArrayBuffer): BackupData {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  const transactions: Transaction[] = []
  const assets: Asset[] = []
  const liabilities: Liability[] = []

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (rows.length === 0) continue

    const firstRow = rows[0]
    const keys = Object.keys(firstRow).map((k) => k.toLowerCase())

    // Detect sheet type by column names
    if (keys.includes('_type') && (keys.includes('amount') || keys.includes('金額'))) {
      // Transaction sheet
      rows.forEach((row, i) => {
        const rawType = str(row['_type'] ?? row['類型'])
        const type = rawType === 'income' || rawType === '收入' ? 'income'
          : rawType === 'expense' || rawType === '支出' ? 'expense'
          : null
        if (!type) return
        const amount = num(row['amount'] ?? row['金額'])
        if (isNaN(amount) || amount <= 0) throw new Error(`收支記錄第 ${i + 2} 行：金額格式錯誤`)
        transactions.push({
          id: crypto.randomUUID(),
          type,
          category: str(row['category'] ?? row['類別']),
          amount,
          currency: str(row['currency'] ?? row['幣別']) || 'TWD',
          date: parseDate(row['date'] ?? row['日期']),
          description: str(row['description'] ?? row['備註']),
        })
      })
    } else if (keys.includes('市值') || keys.includes('value') || (keys.includes('名稱') && keys.includes('幣別') && !keys.includes('餘額'))) {
      // Asset sheet
      const assetTypeMap: Record<string, Asset['type']> = {
        '現金/存款': 'cash', cash: 'cash',
        '股票/基金': 'investment', investment: 'investment',
        '房產': 'property', property: 'property',
        '其他': 'other', other: 'other',
      }
      rows.forEach((row) => {
        const name = str(row['名稱'] ?? row['name'])
        if (!name) return
        const rawType = str(row['_type'] ?? row['類型'] ?? row['type'])
        assets.push({
          id: crypto.randomUUID(),
          name,
          value: num(row['市值'] ?? row['value']),
          currency: str(row['幣別'] ?? row['currency']) || 'TWD',
          type: assetTypeMap[rawType] ?? 'other',
          annualReturn: row['年化報酬率'] || row['annualReturn']
            ? num(row['年化報酬率'] ?? row['annualReturn']) : undefined,
        })
      })
    } else if (keys.includes('餘額') || keys.includes('amount') || (keys.includes('名稱') && keys.includes('幣別'))) {
      // Liability sheet
      const liabilityTypeMap: Record<string, Liability['type']> = {
        '個人貸款': 'loan', loan: 'loan',
        '房貸': 'mortgage', mortgage: 'mortgage',
        '信用卡': 'credit', credit: 'credit',
        '其他': 'other', other: 'other',
      }
      rows.forEach((row) => {
        const name = str(row['名稱'] ?? row['name'])
        if (!name) return
        const rawType = str(row['_type'] ?? row['類型'] ?? row['type'])
        liabilities.push({
          id: crypto.randomUUID(),
          name,
          amount: num(row['餘額'] ?? row['amount']),
          currency: str(row['幣別'] ?? row['currency']) || 'TWD',
          type: liabilityTypeMap[rawType] ?? 'other',
          interestRate: row['年利率'] || row['interestRate']
            ? num(row['年利率'] ?? row['interestRate']) : undefined,
        })
      })
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    assets,
    liabilities,
  }
}

// ── CSV parse (unchanged) ─────────────────────────────────────────────────────

export function parseCSV(text: string): Omit<Transaction, 'id'>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (lines.length < 2) throw new Error('CSV 內容為空')

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
  const idx = (key: string) => {
    const i = header.indexOf(key)
    if (i === -1) throw new Error(`CSV 缺少欄位：${key}`)
    return i
  }

  const typeIdx = idx('type')
  const catIdx = idx('category')
  const amtIdx = idx('amount')
  const curIdx = idx('currency')
  const dateIdx = idx('date')
  const descIdx = header.indexOf('description')

  return lines.slice(1).map((line, i) => {
    const cols = splitCSVLine(line)
    const type = cols[typeIdx]?.trim()
    if (type !== 'income' && type !== 'expense') {
      throw new Error(`第 ${i + 2} 行：type 必須為 income 或 expense`)
    }
    const amount = parseFloat(cols[amtIdx])
    if (isNaN(amount)) throw new Error(`第 ${i + 2} 行：amount 格式錯誤`)
    return {
      type,
      category: cols[catIdx]?.trim() ?? '',
      amount,
      currency: cols[curIdx]?.trim() ?? 'TWD',
      date: cols[dateIdx]?.trim() ?? '',
      description: descIdx >= 0 ? (cols[descIdx]?.trim() ?? '') : '',
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

function num(val: unknown): number {
  return parseFloat(String(val))
}

function parseDate(val: unknown): string {
  if (!val) return new Date().toISOString().split('T')[0]
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val).trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Try parsing
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return s
}

function setColWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map((w) => ({ wch: w }))
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current)
  return result
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatDateForFilename() {
  return new Date().toISOString().split('T')[0]
}
