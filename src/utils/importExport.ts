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

// ── CSV / TSV parse ───────────────────────────────────────────────────────────

/**
 * 解析 CSV 或 TSV（自動偵測分隔符）
 * 支援欄位別名對應，金額允許 "TWD 10,876" 這類格式
 */
export function parseCSV(text: string): Omit<Transaction, 'id'>[] {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Auto-detect delimiter: if header has more tabs than commas → TSV
  const firstLine = normalized.split('\n')[0]
  const delimiter = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ','

  // Split into logical lines (handle quoted multi-line fields)
  const lines = splitLines(normalized, delimiter)
  if (lines.length < 2) throw new Error('CSV 內容為空')

  const rawHeader = lines[0]
  const header = (delimiter === '\t'
    ? rawHeader.split('\t')
    : splitCSVLine(rawHeader)
  ).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))

  // Column alias map: accept various naming conventions
  const ALIASES: Record<string, string[]> = {
    type:        ['type', '類型', '交易類型'],
    category:    ['category', '類別', '交易類別', '手機轉帳'],
    amount:      ['amount', '金額', '交易金額'],
    currency:    ['currency', '幣別', '交易幣別'],
    date:        ['date', 'action_date', '日期', '交易日期', '交易時間'],
    description: ['description', '備註', '說明', 'memo', 'information', 'desc'],
  }

  const resolve = (field: string): number => {
    for (const alias of ALIASES[field]) {
      const i = header.indexOf(alias.toLowerCase())
      if (i !== -1) return i
    }
    return -1
  }

  const typeIdx = resolve('type')
  const catIdx  = resolve('category')
  const amtIdx  = resolve('amount')
  const curIdx  = resolve('currency')
  const dateIdx = resolve('date')
  const descIdx = resolve('description')

  if (typeIdx === -1) throw new Error('找不到 type（類型）欄位')
  if (amtIdx  === -1) throw new Error('找不到 amount（金額）欄位')

  const results: Omit<Transaction, 'id'>[] = []

  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return
    const cols = delimiter === '\t' ? line.split('\t') : splitCSVLine(line)

    const rawType = cols[typeIdx]?.trim() ?? ''
    const type = rawType === 'income' || rawType === '收入' ? 'income'
      : rawType === 'expense' || rawType === '支出' ? 'expense'
      : null
    if (!type) {
      // Skip header-like rows or empty type rows silently
      if (!rawType) return
      throw new Error(`第 ${i + 2} 行：type 必須為 income / expense，實際值：「${rawType}」`)
    }

    const rawAmount = cols[amtIdx]?.trim() ?? ''
    const amount = parseAmount(rawAmount)
    if (isNaN(amount) || amount < 0) throw new Error(`第 ${i + 2} 行：金額格式無法解析：「${rawAmount}」`)

    // Currency: prefer dedicated column, fallback to extracting from amount string
    let currency = curIdx >= 0 ? cols[curIdx]?.trim() ?? '' : ''
    if (!currency) currency = extractCurrency(rawAmount)
    if (!currency) currency = 'TWD'

    const rawDate = dateIdx >= 0 ? (cols[dateIdx]?.trim() ?? '') : ''

    results.push({
      type,
      category: catIdx  >= 0 ? (cols[catIdx]?.trim()  ?? '') : '',
      amount,
      currency,
      date: parseDate(rawDate),
      description: descIdx >= 0 ? (cols[descIdx]?.trim() ?? '') : '',
    })
  })

  if (results.length === 0) throw new Error('沒有找到有效的資料列')
  return results
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse amount strings like "TWD 10,876" / "10876" / "10,876.50" / "-500"
 */
function parseAmount(raw: string): number {
  // Remove currency code prefix (e.g. "TWD ", "USD ")
  const cleaned = raw.replace(/^[A-Z]{3}\s*/i, '').replace(/,/g, '').trim()
  return parseFloat(cleaned)
}

/** Extract 3-letter currency code from strings like "TWD 10,876" */
function extractCurrency(raw: string): string {
  const m = raw.match(/^([A-Z]{3})\s/i)
  return m ? m[1].toUpperCase() : ''
}

/**
 * Split text into logical lines, keeping quoted multi-line fields intact.
 * Returns one element per data row (header + data rows).
 */
function splitLines(text: string, delimiter: string): string[] {
  if (delimiter === '\t') {
    // TSV: quoted multi-line is rare, just split normally
    return text.split('\n')
  }
  // CSV: handle quoted fields that span multiple lines
  const rows: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes; current += ch }
    } else if (ch === '\n' && !inQuotes) {
      rows.push(current); current = ''
    } else {
      current += ch
    }
  }
  if (current) rows.push(current)
  return rows
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
