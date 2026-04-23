import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useConvert } from '../../hooks/useConvert'
import { formatCurrency, formatLargeNumber } from '../../utils/currency'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1']

function safe(n: number) { return isFinite(n) && !isNaN(n) ? n : 0 }

function calcCAGR(avgCost: number, currentPrice: number, purchaseDate?: string): number | null {
  if (!purchaseDate || avgCost <= 0 || currentPrice <= 0) return null
  const days = (Date.now() - new Date(purchaseDate).getTime()) / 86_400_000
  if (days < 1) return null
  return (Math.pow(currentPrice / avgCost, 1 / (days / 365)) - 1) * 100
}

function projectValue(currentValue: number, cagrPct: number, years: number): number {
  return currentValue * Math.pow(1 + cagrPct / 100, years)
}

export default function StockCharts() {
  const { stockPositions, settings } = useFinanceStore()
  const { toDisplay } = useConvert()
  const currency = settings.currency

  const enriched = useMemo(() => stockPositions.map((p) => {
    const price    = p.currentPrice ?? p.avgCost
    const cur      = p.currentPrice !== undefined ? (p.currentCurrency ?? p.currency) : p.currency
    const value    = toDisplay(safe(p.shares * price), cur)
    const cost     = toDisplay(safe(p.shares * p.avgCost), p.currency)
    const pnl      = value - cost
    const pnlPct   = cost > 0 ? (pnl / cost) * 100 : 0
    const cagr     = p.currentPrice !== undefined ? calcCAGR(p.avgCost, p.currentPrice, p.purchaseDate) : null
    const label    = p.name ? `${p.symbol}\n${p.name}` : p.symbol
    return { ...p, value, cost, pnl, pnlPct, cagr, label }
  }), [stockPositions, settings.currency]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalValue = enriched.reduce((s, p) => s + p.value, 0)
  const totalCost  = enriched.reduce((s, p) => s + p.cost, 0)
  const totalPnl   = totalValue - totalCost

  // Portfolio allocation by symbol
  const allocationData = enriched
    .filter((p) => p.value > 0)
    .map((p) => ({ name: p.symbol, value: Math.round(p.value) }))

  // P&L per stock
  const pnlData = enriched.map((p) => ({
    symbol: p.symbol,
    損益: Math.round(p.pnl),
    損益率: parseFloat(p.pnlPct.toFixed(2)),
  }))

  // CAGR comparison
  const cagrData = enriched
    .filter((p) => p.cagr !== null)
    .map((p) => ({ symbol: p.symbol, 年化報酬率: parseFloat((p.cagr as number).toFixed(2)) }))
    .sort((a, b) => b.年化報酬率 - a.年化報酬率)

  // Projected profit table (using CAGR if available, fallback to 10% market avg)
  const DEFAULT_RATE = 10
  const projectionYears = [1, 3, 5, 10]

  const projectionData = enriched.map((p) => {
    const rate = p.cagr !== null ? p.cagr : DEFAULT_RATE
    return {
      symbol: p.symbol,
      name: p.name,
      currentValue: p.value,
      cost: p.cost,
      rate,
      hasActualCagr: p.cagr !== null,
      proj1:  Math.round(projectValue(p.value, rate, 1)),
      proj3:  Math.round(projectValue(p.value, rate, 3)),
      proj5:  Math.round(projectValue(p.value, rate, 5)),
      proj10: Math.round(projectValue(p.value, rate, 10)),
    }
  })

  // Aggregate portfolio growth curve
  const growthCurve = projectionYears.map((yr) => ({
    year: `${yr}年後`,
    預估市值: Math.round(projectionData.reduce((s, p) => s + projectValue(p.currentValue, p.rate, yr), 0)),
    累計成本: Math.round(totalCost),
  }))
  growthCurve.unshift({ year: '現在', 預估市值: Math.round(totalValue), 累計成本: Math.round(totalCost) })

  if (stockPositions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-600 text-sm border border-gray-100 dark:border-gray-700">
        尚未新增持股，請前往「財務列表 → 股票帳本」新增
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="股票總市值" value={formatLargeNumber(totalValue, currency)} />
        <SummaryCard label="總成本" value={formatLargeNumber(totalCost, currency)} />
        <SummaryCard
          label="未實現損益"
          value={`${totalPnl >= 0 ? '+' : ''}${formatLargeNumber(totalPnl, currency)}`}
          color={totalPnl >= 0 ? 'green' : 'red'}
          sub={totalCost > 0 ? `${((totalPnl / totalCost) * 100).toFixed(2)}%` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Allocation */}
        <ChartCard title="持股配置">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                paddingAngle={2} dataKey="value" isAnimationActive={false}>
                {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* P&L per stock */}
        <ChartCard title="各股未實現損益">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pnlData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatLargeNumber(v, currency)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="symbol" width={64} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              <Bar dataKey="損益" isAnimationActive={false} radius={[0, 4, 4, 0]}>
                {pnlData.map((entry, i) => (
                  <Cell key={i} fill={entry.損益 >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* CAGR comparison */}
        {cagrData.length > 0 && (
          <ChartCard title="年化報酬率比較（CAGR）">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cagrData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="symbol" width={64} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Bar dataKey="年化報酬率" isAnimationActive={false} radius={[0, 4, 4, 0]}>
                  {cagrData.map((entry, i) => (
                    <Cell key={i} fill={entry.年化報酬率 >= 0 ? '#8b5cf6' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Portfolio growth curve */}
        <ChartCard title="投資組合預估成長">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growthCurve}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatLargeNumber(v, currency)} tick={{ fontSize: 10 }} width={75} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="預估市值" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="累計成本" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Projection Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">各股年化報酬率與利潤預測</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">股票</th>
                <th className="text-right py-2 pr-4 font-medium">現值</th>
                <th className="text-right py-2 pr-4 font-medium">年化報酬率</th>
                <th className="text-right py-2 pr-4 font-medium">+1年獲利</th>
                <th className="text-right py-2 pr-4 font-medium">+3年獲利</th>
                <th className="text-right py-2 pr-4 font-medium">+5年獲利</th>
                <th className="text-right py-2 font-medium">+10年獲利</th>
              </tr>
            </thead>
            <tbody>
              {projectionData.map((p) => (
                <tr key={p.symbol} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{p.symbol}</p>
                    {p.name && <p className="text-xs text-gray-400">{p.name}</p>}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                    {formatLargeNumber(p.currentValue, currency)}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className={`font-medium ${p.rate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {p.rate >= 0 ? '+' : ''}{p.rate.toFixed(1)}%
                    </span>
                    {!p.hasActualCagr && <span className="text-xs text-gray-400 ml-1">(預設)</span>}
                  </td>
                  {[p.proj1, p.proj3, p.proj5, p.proj10].map((proj, i) => {
                    const profit = proj - p.currentValue
                    return (
                      <td key={i} className="py-2.5 pr-4 text-right last:pr-0">
                        <p className="text-gray-800 dark:text-gray-200">{formatLargeNumber(proj, currency)}</p>
                        <p className={`text-xs ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {profit >= 0 ? '+' : ''}{formatLargeNumber(profit, currency)}
                        </p>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-xs font-semibold text-gray-600 dark:text-gray-300 border-t-2 border-gray-200 dark:border-gray-600">
                <td className="pt-3 pr-4">合計</td>
                <td className="pt-3 pr-4 text-right">{formatLargeNumber(totalValue, currency)}</td>
                <td className="pt-3 pr-4" />
                {projectionYears.map((yr) => {
                  const total = projectionData.reduce((s, p) => s + projectValue(p.currentValue, p.rate, yr), 0)
                  const profit = total - totalValue
                  return (
                    <td key={yr} className="pt-3 pr-4 text-right last:pr-0">
                      <p>{formatLargeNumber(total, currency)}</p>
                      <p className={`text-xs font-normal ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {profit >= 0 ? '+' : ''}{formatLargeNumber(profit, currency)}
                      </p>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          * 有買入日期的持股使用實際 CAGR；無買入日期者使用預設 {DEFAULT_RATE}% 年化報酬率
        </p>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function SummaryCard({ label, value, color, sub }: {
  label: string; value: string; color?: 'green' | 'red'; sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${
        color === 'green' ? 'text-green-600 dark:text-green-400' :
        color === 'red'   ? 'text-red-500 dark:text-red-400' :
        'text-gray-900 dark:text-white'
      }`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${color === 'green' ? 'text-green-500' : color === 'red' ? 'text-red-400' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}
