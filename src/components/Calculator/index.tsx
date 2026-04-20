import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency, formatLargeNumber } from '../../utils/currency'
import { calcFutureValue, generateGrowthSeries, calcLoanPayment } from '../../utils/calculations'
import { CURRENCIES } from '../../types'
import { inputClass } from '../FinancialList/TransactionForm'

type CalcMode = 'compound' | 'loan'

export default function Calculator() {
  const { settings } = useFinanceStore()
  const [mode, setMode] = useState<CalcMode>('compound')

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 w-fit">
        <button
          onClick={() => setMode('compound')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            mode === 'compound'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          複利試算
        </button>
        <button
          onClick={() => setMode('loan')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            mode === 'loan'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          貸款試算
        </button>
      </div>

      {mode === 'compound' ? (
        <CompoundCalculator defaultCurrency={settings.currency} />
      ) : (
        <LoanCalculator defaultCurrency={settings.currency} />
      )}
    </div>
  )
}

function CompoundCalculator({ defaultCurrency }: { defaultCurrency: string }) {
  const [form, setForm] = useState({
    principal: '1000000',
    monthlyContribution: '10000',
    annualReturn: '7',
    years: '20',
    currency: defaultCurrency,
  })

  const principal = parseFloat(form.principal) || 0
  const monthly = parseFloat(form.monthlyContribution) || 0
  const rate = parseFloat(form.annualReturn) || 0
  const years = parseInt(form.years) || 0

  const futureValue = calcFutureValue(principal, monthly, rate, years)
  const totalContributed = principal + monthly * years * 12
  const totalInterest = futureValue - totalContributed
  const growthSeries = generateGrowthSeries(principal, monthly, rate, Math.min(years, 40))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">複利計算參數</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label="幣別">
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={inputClass}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
            </select>
          </Field>
          <Field label="本金">
            <input type="number" value={form.principal} onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))} className={inputClass} placeholder="0" />
          </Field>
          <Field label="每月定投">
            <input type="number" value={form.monthlyContribution} onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))} className={inputClass} placeholder="0" />
          </Field>
          <Field label="年化報酬率 (%)">
            <input type="number" step="0.1" value={form.annualReturn} onChange={(e) => setForm((f) => ({ ...f, annualReturn: e.target.value }))} className={inputClass} placeholder="7" />
          </Field>
          <Field label="投資年限">
            <input type="number" value={form.years} onChange={(e) => setForm((f) => ({ ...f, years: e.target.value }))} className={inputClass} placeholder="20" />
          </Field>
        </div>

        {/* Result Cards */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          <ResultCard label="終值（本金 + 利息）" value={formatLargeNumber(futureValue, form.currency)} highlight />
          <div className="grid grid-cols-2 gap-3">
            <ResultCard label="總投入本金" value={formatLargeNumber(totalContributed, form.currency)} />
            <ResultCard label="利息獲利" value={formatLargeNumber(totalInterest, form.currency)} color="green" />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
            報酬倍數：<strong className="text-blue-600">{(futureValue / (totalContributed || 1)).toFixed(2)}x</strong>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">資產增長曲線</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={growthSeries}>
            <defs>
              <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tickFormatter={(v) => `${v}年`} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatLargeNumber(v, form.currency)} tick={{ fontSize: 10 }} width={80} />
            <Tooltip formatter={(v: number) => formatCurrency(v, form.currency)} labelFormatter={(l) => `第 ${l} 年`} />
            <Legend />
            <Area type="monotone" dataKey="value" name="資產終值" stroke="#3b82f6" fill="url(#valueGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="contributed" name="累計投入" stroke="#10b981" fill="url(#contribGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LoanCalculator({ defaultCurrency }: { defaultCurrency: string }) {
  const [form, setForm] = useState({
    principal: '10000000',
    annualRate: '2.5',
    years: '20',
    currency: defaultCurrency,
  })

  const principal = parseFloat(form.principal) || 0
  const rate = parseFloat(form.annualRate) || 0
  const years = parseInt(form.years) || 0

  const monthlyPayment = calcLoanPayment(principal, rate, years)
  const totalPayment = monthlyPayment * years * 12
  const totalInterest = totalPayment - principal

  // Amortization schedule (yearly)
  const yearlySchedule = (() => {
    const r = rate / 100 / 12
    let balance = principal
    const schedule = []
    for (let y = 1; y <= Math.min(years, 30); y++) {
      let yearInterest = 0
      let yearPrincipal = 0
      for (let m = 0; m < 12; m++) {
        const interestPay = balance * r
        const principalPay = monthlyPayment - interestPay
        yearInterest += interestPay
        yearPrincipal += principalPay
        balance = Math.max(0, balance - principalPay)
      }
      schedule.push({
        year: `第${y}年`,
        利息: Math.round(yearInterest),
        還本: Math.round(yearPrincipal),
        餘額: Math.round(balance),
      })
    }
    return schedule
  })()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">貸款計算參數</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="幣別">
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={inputClass}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
            </select>
          </Field>
          <Field label="貸款金額">
            <input type="number" value={form.principal} onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="年利率 (%)">
            <input type="number" step="0.1" value={form.annualRate} onChange={(e) => setForm((f) => ({ ...f, annualRate: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="貸款年限">
            <input type="number" value={form.years} onChange={(e) => setForm((f) => ({ ...f, years: e.target.value }))} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <ResultCard label="每月還款" value={formatCurrency(monthlyPayment, form.currency)} highlight />
          <div className="grid grid-cols-2 gap-3">
            <ResultCard label="還款總額" value={formatLargeNumber(totalPayment, form.currency)} />
            <ResultCard label="總利息" value={formatLargeNumber(totalInterest, form.currency)} color="red" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">還款結構（逐年）</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={yearlySchedule}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={Math.floor(yearlySchedule.length / 5)} />
            <YAxis tickFormatter={(v) => formatLargeNumber(v, form.currency)} tick={{ fontSize: 10 }} width={80} />
            <Tooltip formatter={(v: number) => formatCurrency(v, form.currency)} />
            <Legend />
            <Area type="monotone" dataKey="還本" stroke="#10b981" fill="#10b98130" strokeWidth={2} stackId="1" />
            <Area type="monotone" dataKey="利息" stroke="#ef4444" fill="#ef444430" strokeWidth={2} stackId="1" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ResultCard({ label, value, highlight, color }: {
  label: string; value: string; highlight?: boolean; color?: 'green' | 'red'
}) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${
        highlight ? 'text-blue-600 dark:text-blue-400' :
        color === 'green' ? 'text-green-600 dark:text-green-400' :
        color === 'red' ? 'text-red-500 dark:text-red-400' :
        'text-gray-900 dark:text-white'
      }`}>{value}</p>
    </div>
  )
}
