import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import type { Asset, StockPosition } from '../types'

// Point pdf.js worker to the bundled worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

// ── Extracted types ──────────────────────────────────────────────────────────

export interface ExtractedAsset {
  id: string
  name: string
  value: number
  currency: string
  type: Asset['type']
  raw: string
}

export interface ExtractedStock {
  id: string
  symbol: string
  name: string
  shares: number
  avgCost: number
  currency: string
  purchaseDate?: string
  raw: string
}

export interface ExtractedTransaction {
  id: string
  date: string          // YYYY-MM-DD
  description: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category: string
  balance?: number
  note?: string
  raw: string
}

export interface PPTParseResult {
  fileName: string
  slides: string[][]
  assets: ExtractedAsset[]
  stocks: ExtractedStock[]
  transactions: ExtractedTransaction[]
  rawText: string
  debugInfo: string  // diagnostic info shown in UI
}

// ── Pattern helpers ──────────────────────────────────────────────────────────

const CURRENCY_RE = /\b(TWD|USD|EUR|JPY|GBP|CNY|HKD|SGD|NT\$|US\$|HK\$|S\$)\b/i
const AMOUNT_RE = /(?:NT\$|US\$|HK\$|S\$|TWD|USD|EUR|JPY|GBP|CNY|HKD|SGD)?\s*-?\s*([\d,]+(?:\.\d+)?)/i
const TW_STOCK_RE = /\b(\d{4,6}(?:\.[A-Z]{2})?)\b/

function parseCurrency(text: string): string {
  const m = text.match(CURRENCY_RE)
  if (!m) return 'TWD'
  const s = m[1].toUpperCase()
  if (s === 'NT$') return 'TWD'
  if (s === 'US$') return 'USD'
  if (s === 'HK$') return 'HKD'
  if (s === 'S$') return 'SGD'
  return s
}

function parseAmount(text: string): number | null {
  const m = text.match(AMOUNT_RE)
  if (!m) return null
  const v = parseFloat(m[1].replace(/,/g, ''))
  return isFinite(v) && v > 0 ? v : null
}

function parseAmountCell(text: string): number {
  // strips any non-numeric except dot/comma
  const clean = text.replace(/[^\d,.]/g, '').replace(/,/g, '')
  const v = parseFloat(clean)
  return isFinite(v) ? v : 0
}

function detectAssetType(text: string): Asset['type'] {
  if (/股票|持股|ETF|基金|投資|證券/.test(text)) return 'investment'
  if (/房|不動產|土地|建物|地產/.test(text)) return 'property'
  if (/存款|現金|銀行|儲蓄|定存|活存|帳戶/.test(text)) return 'cash'
  return 'other'
}

function looksLikeTWStock(sym: string): boolean {
  return /^\d{4,6}$/.test(sym)
}

function looksLikeUSStock(sym: string): boolean {
  const COMMON_WORDS = new Set(['IT', 'AT', 'BY', 'BE', 'DO', 'GO', 'IF', 'IN', 'IS', 'OF', 'ON', 'OR', 'TO', 'UP', 'US', 'WE'])
  return /^[A-Z]{2,5}$/.test(sym) && !COMMON_WORDS.has(sym)
}

let _idCounter = 0
function genId() { return `ppt_${Date.now()}_${++_idCounter}` }

// ── Bank statement column detection ─────────────────────────────────────────

// Maps header text → canonical column key
const HEADER_ALIASES: Record<string, string> = {
  '日期': 'date', '交易日期': 'date', '記帳日': 'date',
  '摘要': 'description', '說明': 'description', '交易說明': 'description', '備註': 'note',
  '支出': 'expense', '提款': 'expense', '借方': 'expense', '支出金額': 'expense',
  '存入': 'income', '存款': 'income', '貸方': 'income', '存入金額': 'income',
  '結餘': 'balance', '餘額': 'balance', '帳戶餘額': 'balance',
  '對方帳號': 'counterpart', '對方帳戶': 'counterpart',
  '註記': 'remark',
}

function normalizeHeader(h: string): string | null {
  const t = h.trim()
  return HEADER_ALIASES[t] ?? null
}

// Parse a date cell; handles:
//   YYYY/MM/DD, YYYY-MM-DD, YYY/MM/DD (ROC), MM/DD
function parseDate(raw: string): string {
  // Strip time component: "2026/04/15 21:02:30" → "2026/04/15"
  const s = raw.trim().split(/\s+/)[0].replace(/\./g, '/')
  // ROC calendar: 3-digit year like 113/01/15
  const roc = s.match(/^(\d{3})\/(\d{1,2})\/(\d{1,2})$/)
  if (roc) {
    const y = parseInt(roc[1]) + 1911
    return `${y}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}`
  }
  // YYYY/MM/DD or YYYY-MM-DD
  const full = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (full) return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`
  // MM/DD (no year — use current year)
  const md = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (md) return `${new Date().getFullYear()}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
  return s
}

function guessCategory(desc: string): string {
  if (/ATM|提款|現金/.test(desc)) return '其他'
  if (/薪|工資|salary/i.test(desc)) return '薪資'
  if (/利息|定存|活存/.test(desc)) return '投資收益'
  if (/轉帳|匯款|wire/i.test(desc)) return '其他'
  if (/餐|食|飲|便利/.test(desc)) return '餐飲'
  if (/交通|捷運|公車|停車|油|加油/.test(desc)) return '交通'
  if (/電費|水費|瓦斯|電話|網路|租金|房租/.test(desc)) return '住房'
  if (/醫|藥|診/.test(desc)) return '醫療'
  if (/學|教育|書/.test(desc)) return '教育'
  if (/娛樂|電影|遊戲/.test(desc)) return '娛樂'
  if (/保險/.test(desc)) return '保險'
  return '其他'
}

// Detect if a set of column keys looks like a bank statement
function isBankStatementSchema(keys: string[]): boolean {
  const s = new Set(keys)
  return (s.has('date') || s.has('description')) &&
    (s.has('expense') || s.has('income') || s.has('balance'))
}

// Convert column-mapped rows to transactions
function rowsToTransactions(rows: Record<string, string>[], currency: string): ExtractedTransaction[] {
  const txs: ExtractedTransaction[] = []
  for (const row of rows) {
    const dateRaw = row['date'] ?? ''
    const desc = (row['description'] ?? row['note'] ?? '').trim()
    const expenseRaw = row['expense'] ?? ''
    const incomeRaw = row['income'] ?? ''
    const balanceRaw = row['balance'] ?? ''
    const noteRaw = [row['note'], row['remark']].filter(Boolean).join(' ')

    const expense = parseAmountCell(expenseRaw)
    const income = parseAmountCell(incomeRaw)
    const balance = parseAmountCell(balanceRaw)

    // Skip rows that have no amount and no date (likely sub-headers or separators)
    if (!dateRaw && expense === 0 && income === 0) continue

    const date = dateRaw ? parseDate(dateRaw) : new Date().toISOString().slice(0, 10)
    const raw = Object.values(row).join(' | ')

    if (expense > 0) {
      txs.push({
        id: genId(),
        date,
        description: desc,
        type: 'expense',
        amount: expense,
        currency,
        category: guessCategory(desc),
        balance: balance || undefined,
        note: noteRaw || undefined,
        raw,
      })
    }
    if (income > 0) {
      txs.push({
        id: genId(),
        date,
        description: desc,
        type: 'income',
        amount: income,
        currency,
        category: guessCategory(desc),
        balance: balance || undefined,
        note: noteRaw || undefined,
        raw,
      })
    }
    // Row with only balance (opening balance) — skip
  }
  return txs
}

// ── XML text extraction (PPTX) ───────────────────────────────────────────────

function extractTextFromXML(xml: string): string[] {
  const texts: string[] = []

  const tableRe = /<a:tbl[\s\S]*?<\/a:tbl>/g
  const tableMatches = xml.match(tableRe) || []
  for (const tableXml of tableMatches) {
    const rowRe = /<a:tr[\s\S]*?<\/a:tr>/g
    const rows = tableXml.match(rowRe) || []
    for (const rowXml of rows) {
      const cellRe = /<a:tc[\s\S]*?<\/a:tc>/g
      const cells = rowXml.match(cellRe) || []
      const cellTexts = cells.map((c) => {
        const inner = c.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || []
        return inner.map((t) => t.replace(/<[^>]+>/g, '')).join('').trim()
      }).filter(Boolean)
      if (cellTexts.length > 0) texts.push(cellTexts.join('\t'))
    }
    xml = xml.replace(tableXml, '')
  }

  const paraRe = /<a:p[\s\S]*?<\/a:p>/g
  const paras = xml.match(paraRe) || []
  for (const para of paras) {
    const inner = para.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || []
    const combined = inner.map((t) => t.replace(/<[^>]+>/g, '')).join('').trim()
    if (combined) texts.push(combined)
  }

  return texts
}

// ── Asset/Stock inference ────────────────────────────────────────────────────

function inferFromLines(lines: string[]): { assets: ExtractedAsset[]; stocks: ExtractedStock[] } {
  const assets: ExtractedAsset[] = []
  const stocks: ExtractedStock[] = []
  const seenNames = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const amount = parseAmount(line)
    const currency = parseCurrency(line)

    const parts = line.split('\t').map((s) => s.trim())
    if (parts.length >= 3) {
      const sym = parts[0]
      if (looksLikeTWStock(sym) || looksLikeUSStock(sym)) {
        const shares = parseFloat(parts[2].replace(/,/g, ''))
        const cost = parseFloat((parts[3] ?? parts[2]).replace(/,/g, ''))
        if (isFinite(shares) && shares > 0) {
          stocks.push({
            id: genId(), symbol: sym, name: parts[1] || sym, shares,
            avgCost: isFinite(cost) && cost > 0 ? cost : 0, currency, raw: line,
          })
          continue
        }
      }
    }

    const twM = line.match(TW_STOCK_RE)
    if (twM && looksLikeTWStock(twM[1]) && amount) {
      const sym = twM[1]
      const nextLine = lines[i + 1] ?? ''
      const sharesM = nextLine.match(/([\d,]+)\s*(?:股|張|shares?)/i)
      const shares = sharesM ? parseFloat(sharesM[1].replace(/,/g, '')) : 0
      stocks.push({
        id: genId(), symbol: sym,
        name: line.replace(twM[0], '').replace(AMOUNT_RE, '').trim() || sym,
        shares, avgCost: shares > 0 ? amount / shares : amount, currency, raw: line,
      })
      continue
    }

    if (amount && amount > 0) {
      const name = line
        .replace(AMOUNT_RE, '').replace(CURRENCY_RE, '').replace(/[:\-—–|]/g, ' ')
        .trim().slice(0, 50) || `資產 ${i + 1}`

      if (seenNames.has(name)) continue
      seenNames.add(name)

      assets.push({ id: genId(), name, value: amount, currency, type: detectAssetType(line), raw: line })
    }
  }

  return { assets, stocks }
}

// ── PPTX parser ──────────────────────────────────────────────────────────────

export async function parsePPTX(file: File): Promise<PPTParseResult> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const slideEntries: [number, JSZip.JSZipObject][] = []
  zip.forEach((path, entry) => {
    const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/i)
    if (m) slideEntries.push([parseInt(m[1]), entry])
  })
  slideEntries.sort((a, b) => a[0] - b[0])

  const slides: string[][] = []
  const allLines: string[] = []

  for (const [, entry] of slideEntries) {
    const xml = await entry.async('text')
    const lines = extractTextFromXML(xml)
    slides.push(lines)
    allLines.push(...lines)
  }

  const rawText = allLines.join('\n')
  const { assets, stocks } = inferFromLines(allLines)

  return { fileName: file.name, slides, assets, stocks, transactions: [], rawText, debugInfo: `PPTX: ${slideEntries.length} slides` }
}

// ── PDF parser ───────────────────────────────────────────────────────────────

interface TextItem { str: string; x: number; y: number }

export async function parsePDF(file: File): Promise<PPTParseResult> {
  const buffer = await file.arrayBuffer()

  // Use absolute URL so it resolves correctly from inside the pdfjs web worker
  const cMapUrl = `${window.location.origin}/cmaps/`
  console.log('[parsePDF] cMapUrl:', cMapUrl)

  const pdf = await pdfjsLib.getDocument({
    data: buffer,
    cMapUrl,
    cMapPacked: true,
    useWorkerFetch: false, // fetch cmaps from main thread to avoid worker URL issues
  }).promise

  console.log('[parsePDF] pages:', pdf.numPages)

  // Collect ALL text items across all pages
  const PAGE_Y_OFFSET = 2000
  const allItems: TextItem[] = []
  const slides: string[][] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const pageHeight = viewport.height
    const yBase = (p - 1) * PAGE_Y_OFFSET

    const pageItems: TextItem[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const tf = (item as { transform: number[] }).transform
      pageItems.push({
        str: item.str,
        x: Math.round(tf[4]),
        y: yBase + Math.round(pageHeight - tf[5]),
      })
    }
    allItems.push(...pageItems)

    const byY = new Map<number, string[]>()
    for (const it of pageItems) {
      const bucket = byY.get(it.y) ?? []
      bucket.push(it.str)
      byY.set(it.y, bucket)
    }
    const lines = [...byY.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, words]) => words.join(' ').trim())
      .filter(Boolean)
    slides.push(lines)
  }

  const rawText = slides.flat().join('\n')
  console.log('[parsePDF] total text items:', allItems.length, '| raw lines:', rawText.split('\n').filter(Boolean).length)
  console.log('[parsePDF] first 10 items:', allItems.slice(0, 10).map(i => `[y=${i.y} x=${i.x}] "${i.str}"`))

  // ── Reconstruct table ─────────────────────────────────────────────────────

  const ROW_TOL = 5
  const rows: TextItem[][] = []
  const sortedByY = [...allItems].sort((a, b) => a.y - b.y)
  for (const item of sortedByY) {
    const existing = rows.find((r) => Math.abs(r[0].y - item.y) <= ROW_TOL)
    if (existing) { existing.push(item); continue }
    rows.push([item])
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x)

  console.log('[parsePDF] total rows:', rows.length)

  // Find header row (any row with ≥3 recognized bank statement headers)
  let headerRow: TextItem[] | null = null
  let headerRowIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const matched = rows[i].filter((it) => normalizeHeader(it.str.trim()) !== null)
    if (matched.length >= 3) { headerRow = rows[i]; headerRowIdx = i; break }
  }
  console.log('[parsePDF] header found at row index:', headerRowIdx, headerRow?.map(i => i.str))

  let transactions: ExtractedTransaction[] = []
  let debugInfo = `PDF: ${pdf.numPages} pages | text items: ${allItems.length} | rows: ${rows.length} | header: ${headerRowIdx >= 0 ? `row ${headerRowIdx} (${headerRow?.map(i => i.str).join(', ')})` : 'not found'}`

  if (headerRow) {
    const colDefs = headerRow
      .map((it) => ({ x: it.x, key: normalizeHeader(it.str.trim()) }))
      .filter((c): c is { x: number; key: string } => c.key !== null)
      .sort((a, b) => a.x - b.x)

    const colBounds = colDefs.map((col, i) => ({
      ...col,
      xMin: i === 0 ? 0 : Math.round((col.x + colDefs[i - 1].x) / 2),
      xMax: colDefs[i + 1] ? Math.round((col.x + colDefs[i + 1].x) / 2) : Infinity,
    }))

    const currency = parseCurrency(slides.flat().slice(0, 30).join(' ')) || 'TWD'

    const dataRows: Record<string, string>[] = []
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      const mapped: Record<string, string> = {}
      for (const item of row) {
        const col = colBounds.find((c) => item.x >= c.xMin && item.x < c.xMax)
          ?? colBounds.reduce((best, c) => Math.abs(item.x - c.x) < Math.abs(item.x - best.x) ? c : best)
        mapped[col.key] = mapped[col.key] ? mapped[col.key] + ' ' + item.str : item.str
      }
      if (Object.keys(mapped).length > 0) dataRows.push(mapped)
    }

    console.log('[parsePDF] data rows:', dataRows.length, '| sample:', dataRows[0])

    if (isBankStatementSchema(colDefs.map((c) => c.key))) {
      transactions = rowsToTransactions(dataRows, currency)
    }
    debugInfo += ` | cols: ${colDefs.map(c => c.key).join(',')} | data rows: ${dataRows.length} | txs: ${transactions.length}`
  }

  console.log('[parsePDF] transactions:', transactions.length)

  const { assets, stocks } = transactions.length === 0
    ? inferFromLines(slides.flat())
    : { assets: [], stocks: [] }

  return { fileName: file.name, slides, assets, stocks, transactions, rawText, debugInfo }
}

// ── Unified entry point ───────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<PPTParseResult> {
  if (/\.pdf$/i.test(file.name)) return parsePDF(file)
  return parsePPTX(file)
}

// ── Store adapters ────────────────────────────────────────────────────────────

export function toAsset(e: ExtractedAsset): Omit<Asset, 'id'> {
  return { name: e.name, value: e.value, currency: e.currency, type: e.type }
}

export function toStockPosition(e: ExtractedStock): Omit<StockPosition, 'id'> {
  return {
    symbol: e.symbol, name: e.name, shares: e.shares,
    avgCost: e.avgCost, currency: e.currency, purchaseDate: e.purchaseDate,
  }
}
