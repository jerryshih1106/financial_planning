import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency } from '../../utils/currency'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

export default function Charts() {
  const { transactions, assets, liabilities, settings } = useFinanceStore()
  const currency = settings.currency

  // Expense breakdown by category (last 3 months)
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => { map[t.category] = (map[t.category] ?? 0) + t.amount })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  // Monthly income vs expense (last 6 months)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      return {
        month: format(d, 'MM月'),
        start: startOfMonth(d),
        end: endOfMonth(d),
        income: 0,
        expense: 0,
      }
    })
    transactions.forEach((t) => {
      const date = parseISO(t.date)
      const bucket = months.find((m) => isWithinInterval(date, { start: m.start, end: m.end }))
      if (bucket) {
        if (t.type === 'income') bucket.income += t.amount
        else bucket.expense += t.amount
      }
    })
    return months.map(({ month, income, expense }) => ({ month, income, expense, net: income - expense }))
  }, [transactions])

  // Asset allocation
  const assetAllocation = useMemo(() => {
    const map: Record<string, number> = {}
    const labels: Record<string, string> = {
      cash: '現金/存款', investment: '股票/基金', property: '房產', other: '其他'
    }
    assets.forEach((a) => {
      const label = labels[a.type] ?? '其他'
      map[label] = (map[label] ?? 0) + a.value
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [assets])

  const netWorth = assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.amount, 0)

  const hasTransactions = transactions.length > 0
  const hasAssets = assets.length > 0

  return (
    <div className="space-y-6">
      {/* Net Worth Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <p className="text-blue-100 text-sm mb-1">目前淨資產</p>
        <p className="text-3xl font-bold">{formatCurrency(netWorth, currency)}</p>
        <p className="text-blue-200 text-xs mt-1">資產 − 負債</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expense */}
        <ChartCard title="月收支趨勢（近6個月）">
          {hasTransactions ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Legend />
                <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="支出" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        {/* Expense Breakdown */}
        <ChartCard title="支出類別佔比">
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        {/* Net Monthly Flow */}
        <ChartCard title="月淨收入趨勢">
          {hasTransactions ? (
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
                <Area
                  type="monotone"
                  dataKey="net"
                  name="淨收入"
                  stroke="#3b82f6"
                  fill="url(#netGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        {/* Asset Allocation */}
        <ChartCard title="資產配置">
          {hasAssets && assetAllocation.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={assetAllocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {assetAllocation.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
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

function EmptyChart() {
  return (
    <div className="h-60 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
      尚無資料
    </div>
  )
}
