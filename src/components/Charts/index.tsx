import { useMemo, useState, Component, type ReactNode } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useConvert, useTotalAssets } from '../../hooks/useConvert'
import { formatCurrency } from '../../utils/currency'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, isValid } from 'date-fns'
import StockCharts from './StockCharts'

type ChartTab = 'overview' | 'stocks'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(n: unknown): number {
  const v = typeof n === 'number' ? n : parseFloat(String(n))
  return isFinite(v) && !isNaN(v) && v >= 0 ? v : 0
}

function safeParseDate(s: unknown): Date | null {
  if (!s) return null
  try {
    const d = parseISO(String(s))
    return isValid(d) ? d : null
  } catch {
    return null
  }
}

// ── Error Boundary ────────────────────────────────────────────────────────────

class ChartErrorBoundary extends Component<{ children: ReactNode; title: string }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) {
      return (
        <div className="h-60 flex flex-col items-center justify-center text-sm text-red-400 gap-1">
          <span>圖表渲染失敗</span>
          <span className="text-xs text-gray-400">{this.state.error}</span>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Charts() {
  const [chartTab, setChartTab] = useState<ChartTab>('overview')
  const { transactions, assets, stockPositions, settings } = useFinanceStore()
  const currency = settings.currency
  const { toDisplay } = useConvert()
  const { totalStockValue, totalAssets, totalLiabilities, netWorth } = useTotalAssets()

  // ── Expense breakdown ───────────────────────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const v = toDisplay(safe(t.amount), t.currency)
        if (v > 0) map[t.category || '其他'] = (map[t.category || '其他'] ?? 0) + v
      })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, settings.currency])

  // ── Monthly income vs expense (last 6 months) ───────────────────────────────
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      return { month: format(d, 'MM月'), start: startOfMonth(d), end: endOfMonth(d), income: 0, expense: 0 }
    })
    for (const t of transactions) {
      const date = safeParseDate(t.date)
      if (!date) continue
      const v = toDisplay(safe(t.amount), t.currency)
      if (v <= 0) continue
      const bucket = months.find((m) => isWithinInterval(date, { start: m.start, end: m.end }))
      if (!bucket) continue
      if (t.type === 'income') bucket.income += v
      else bucket.expense += v
    }
    return months.map(({ month, income, expense }) => ({
      month,
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, settings.currency])

  // ── Asset allocation (converted to display currency) ────────────────────────
  const assetAllocation = useMemo(() => {
    const map: Record<string, number> = {}
    const labels: Record<string, string> = {
      cash: '現金/存款', investment: '股票/基金', property: '房產', other: '其他',
    }
    for (const a of assets) {
      const v = toDisplay(safe(a.value), a.currency)
      if (v > 0) { const l = labels[a.type] ?? '其他'; map[l] = (map[l] ?? 0) + v }
    }
    if (totalStockValue > 0) map['股票帳本'] = (map['股票帳本'] ?? 0) + totalStockValue
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((e) => e.value > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, stockPositions, settings.currency])

  // Fallback net worth when no assets defined
  const totalIncome  = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + toDisplay(safe(t.amount), t.currency), 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + toDisplay(safe(t.amount), t.currency), 0)
  const noAssetsDefined = totalAssets === 0 && totalLiabilities === 0
  const displayNetWorth = noAssetsDefined ? (totalIncome - totalExpense) : netWorth
  const netWorthLabel = noAssetsDefined ? '收支結餘（尚未設定資產）' : '目前淨資產'

  const hasValidTransactions = monthlyData.some((m) => m.income > 0 || m.expense > 0)
  const hasAssets = assetAllocation.length > 0

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 w-fit">
        {(['overview', 'stocks'] as ChartTab[]).map((t) => (
          <button key={t} onClick={() => setChartTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              chartTab === t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>
            {t === 'overview' ? '財務總覽' : '股票分析'}
          </button>
        ))}
      </div>

      {chartTab === 'stocks' && <StockCharts />}
      {chartTab === 'overview' && <>
      {/* Net Worth Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <p className="text-blue-100 text-sm mb-1">{netWorthLabel}</p>
        <p className="text-3xl font-bold">{formatCurrency(displayNetWorth, currency)}</p>
        {!noAssetsDefined && (
          <div className="flex flex-wrap gap-4 mt-2 text-blue-200 text-xs">
            <span>總資產 {formatCurrency(totalAssets, currency)}</span>
            {totalStockValue > 0 && <span>含股票 {formatCurrency(totalStockValue, currency)}</span>}
            <span>負債 {formatCurrency(totalLiabilities, currency)}</span>
          </div>
        )}
        {noAssetsDefined && totalIncome > 0 && (
          <p className="text-blue-200 text-xs mt-1">
            收入 {formatCurrency(totalIncome, currency)} 　支出 {formatCurrency(totalExpense, currency)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expense */}
        <ChartCard title="月收支趨勢（近6個月）">
          <ChartErrorBoundary title="月收支">
            {hasValidTransactions ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} width={80} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Legend />
                  <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="expense" name="支出" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartErrorBoundary>
        </ChartCard>

        {/* Expense Breakdown */}
        <ChartCard title="支出類別佔比">
          <ChartErrorBoundary title="支出佔比">
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartErrorBoundary>
        </ChartCard>

        {/* Net Monthly Flow */}
        <ChartCard title="月淨收入趨勢">
          <ChartErrorBoundary title="淨收入">
            {hasValidTransactions ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} width={80} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Area type="monotone" dataKey="net" name="淨收入" stroke="#3b82f6" fill="url(#netGradient)" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartErrorBoundary>
        </ChartCard>

        {/* Asset Allocation */}
        <ChartCard title="資產配置（含股票帳本）">
          <ChartErrorBoundary title="資產配置">
            {hasAssets ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={assetAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {assetAllocation.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartErrorBoundary>
        </ChartCard>
      </div>
      </>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-60 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
      尚無資料
    </div>
  )
}
