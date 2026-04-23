import { useMemo, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { Target, Zap, Clock, TrendingUp, Edit3 } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useTotalAssets } from '../../hooks/useConvert'
import { formatCurrency, formatLargeNumber } from '../../utils/currency'
import { calcFireNumber, generateGrowthSeries } from '../../utils/calculations'
import { CURRENCIES } from '../../types'
import { inputClass } from '../FinancialList/TransactionForm'

export default function FirePlanning() {
  const { fireSettings, updateFireSettings } = useFinanceStore()
  const { totalAssets } = useTotalAssets()
  const fs = fireSettings

  // Auto-sync currentAssets with real total (including stocks, multi-currency)
  useEffect(() => {
    const rounded = Math.round(totalAssets)
    if (rounded > 0 && rounded !== fs.currentAssets) {
      updateFireSettings({ currentAssets: rounded })
    }
  }, [totalAssets]) // eslint-disable-line react-hooks/exhaustive-deps

  // FIRE target: use custom amount or auto-calculated from 4% rule
  const fireNumber = fs.useCustomTarget
    ? fs.customTargetAmount
    : calcFireNumber(fs.monthlyExpense, fs.safeWithdrawalRate)

  const yearsNeeded = useMemo(() => {
    const r = fs.expectedReturn / 100 / 12
    const target = fireNumber
    if (fs.currentAssets >= target) return 0
    if (r === 0) {
      if (fs.monthlySavings <= 0) return null
      return (target - fs.currentAssets) / fs.monthlySavings / 12
    }
    const pmtOverR = fs.monthlySavings / r
    const ratio = (target + pmtOverR) / (fs.currentAssets + pmtOverR)
    if (ratio <= 0) return null
    return Math.log(ratio) / Math.log(1 + r) / 12
  }, [fireNumber, fs])

  const retirementYear = yearsNeeded !== null ? new Date().getFullYear() + Math.ceil(yearsNeeded ?? 0) : null
  const retirementAge  = yearsNeeded !== null ? fs.currentAge + Math.ceil(yearsNeeded ?? 0) : null
  const maxYears = Math.max(Math.ceil((yearsNeeded ?? 0) + 5), 30)
  const growthSeries = generateGrowthSeries(fs.currentAssets, fs.monthlySavings, fs.expectedReturn, Math.min(maxYears, 50))
  const progress = fireNumber > 0 ? Math.min((fs.currentAssets / fireNumber) * 100, 100) : 0
  const annualExpense = fs.monthlyExpense * 12
  const monthlyPassiveIncome = (fs.currentAssets * (fs.safeWithdrawalRate / 100)) / 12

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Target size={20} />
          <span className="font-semibold">財富自由目標（FIRE）</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-purple-200 text-xs mb-1">
              FIRE 目標金額
              {fs.useCustomTarget && <span className="ml-1 bg-yellow-400/30 px-1 rounded text-yellow-200">自訂</span>}
            </p>
            <p className="text-2xl font-bold">{formatLargeNumber(fireNumber, fs.currency)}</p>
            <p className="text-purple-200 text-xs mt-1">
              {fs.useCustomTarget ? '手動設定目標' : `年支出 ÷ ${fs.safeWithdrawalRate}% 提領率`}
            </p>
          </div>
          <div>
            <p className="text-purple-200 text-xs mb-1">距離財富自由</p>
            {yearsNeeded !== null && yearsNeeded <= 0 ? (
              <p className="text-2xl font-bold text-yellow-300">已達成！</p>
            ) : yearsNeeded !== null ? (
              <>
                <p className="text-2xl font-bold">{Math.ceil(yearsNeeded)} 年</p>
                <p className="text-purple-200 text-xs mt-1">
                  預計 {retirementYear} 年，{retirementAge} 歲
                </p>
              </>
            ) : (
              <p className="text-lg font-bold text-red-300">儲蓄不足</p>
            )}
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-purple-200 mb-1">
            <span>目前進度</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-purple-800/50 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">參數設定</h3>

          <div className="space-y-3">
            <Field label="幣別">
              <select value={fs.currency} onChange={(e) => updateFireSettings({ currency: e.target.value })} className={inputClass}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
              </select>
            </Field>
            <Field label="目前年齡">
              <input type="number" value={fs.currentAge} onChange={(e) => updateFireSettings({ currentAge: +e.target.value })} className={inputClass} />
            </Field>
            <Field label="每月生活支出">
              <input type="number" value={fs.monthlyExpense} onChange={(e) => updateFireSettings({ monthlyExpense: +e.target.value })} className={inputClass} />
            </Field>

            {/* Current assets — show synced value with note */}
            <Field label={<span className="flex items-center gap-1">目前總資產 <span className="text-blue-500 text-xs">(自動同步)</span></span>}>
              <input type="number" value={fs.currentAssets} onChange={(e) => updateFireSettings({ currentAssets: +e.target.value })} className={inputClass} />
            </Field>

            <Field label="每月儲蓄 / 投資">
              <input type="number" value={fs.monthlySavings} onChange={(e) => updateFireSettings({ monthlySavings: +e.target.value })} className={inputClass} />
            </Field>
            <Field label="預期年化報酬率 (%)">
              <input type="number" step="0.5" value={fs.expectedReturn} onChange={(e) => updateFireSettings({ expectedReturn: +e.target.value })} className={inputClass} />
            </Field>

            {/* FIRE Target — toggle */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Edit3 size={12} /> 財富自由目標金額
                </label>
                <button
                  onClick={() => updateFireSettings({ useCustomTarget: !fs.useCustomTarget })}
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                    fs.useCustomTarget
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {fs.useCustomTarget ? '自訂模式' : '4% 法則'}
                </button>
              </div>
              {fs.useCustomTarget ? (
                <input
                  type="number"
                  value={fs.customTargetAmount}
                  onChange={(e) => updateFireSettings({ customTargetAmount: +e.target.value })}
                  className={inputClass}
                  placeholder="目標金額"
                />
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  {formatLargeNumber(calcFireNumber(fs.monthlyExpense, fs.safeWithdrawalRate), fs.currency)}
                  <span className="text-xs text-gray-400 ml-1">(自動計算)</span>
                </div>
              )}
              {!fs.useCustomTarget && (
                <Field label="安全提領率 (%)">
                  <input type="number" step="0.5" value={fs.safeWithdrawalRate} onChange={(e) => updateFireSettings({ safeWithdrawalRate: +e.target.value })} className={inputClass} />
                </Field>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard icon={<Zap size={16} className="text-yellow-500" />} label="每月被動收入（現在）"
              value={formatCurrency(monthlyPassiveIncome, fs.currency)} sub={`目前資產 × ${fs.safeWithdrawalRate}% ÷ 12`} />
            <MetricCard icon={<TrendingUp size={16} className="text-blue-500" />} label="儲蓄率"
              value={`${fs.monthlySavings > 0 && (fs.monthlySavings + fs.monthlyExpense) > 0
                ? ((fs.monthlySavings / (fs.monthlySavings + fs.monthlyExpense)) * 100).toFixed(1) : 0}%`}
              sub="儲蓄 ÷ (儲蓄 + 支出)" />
            <MetricCard icon={<Target size={16} className="text-purple-500" />} label="年支出"
              value={formatLargeNumber(annualExpense, fs.currency)} sub="月支出 × 12" />
            <MetricCard icon={<Clock size={16} className="text-green-500" />} label="FIRE 後月被動收入"
              value={formatCurrency((fireNumber * (fs.safeWithdrawalRate / 100)) / 12, fs.currency)}
              sub={`目標資產 × ${fs.safeWithdrawalRate}% ÷ 12`} />
          </div>

          {/* Growth Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">資產增長預測</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={growthSeries}>
                <defs>
                  <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tickFormatter={(v) => `${v}年`} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatLargeNumber(v, fs.currency)} tick={{ fontSize: 10 }} width={85} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v, fs.currency)}
                  labelFormatter={(l) => `第 ${l} 年（${new Date().getFullYear() + Number(l)} 年）`}
                />
                <Legend />
                <ReferenceLine y={fireNumber} stroke="#f59e0b" strokeDasharray="6 3"
                  label={{ value: 'FIRE 目標', position: 'right', fontSize: 11, fill: '#f59e0b' }} />
                <Area type="monotone" dataKey="value" name="預測資產" stroke="#8b5cf6" fill="url(#fireGrad)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="contributed" name="累計投入" stroke="#10b981" fill="#10b98115" strokeWidth={1.5} strokeDasharray="4 2" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function MetricCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
