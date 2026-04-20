import { useState } from 'react'
import { X } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { CURRENCIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../types'
import type { TransactionType } from '../../types'

export default function TransactionForm({ onClose }: { onClose: () => void }) {
  const { addTransaction, settings } = useFinanceStore()
  const [type, setType] = useState<TransactionType>('expense')
  const [form, setForm] = useState({
    amount: '',
    currency: settings.currency,
    category: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  })

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || !form.category) return
    addTransaction({
      type,
      amount: parseFloat(form.amount),
      currency: form.currency,
      category: form.category,
      date: form.date,
      description: form.description,
    })
    onClose()
  }

  return (
    <Modal title="新增收支記錄" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={() => { setType('expense'); setForm((f) => ({ ...f, category: '' })) }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              type === 'expense'
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => { setType('income'); setForm((f) => ({ ...f, category: '' })) }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              type === 'income'
                ? 'bg-green-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            收入
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="金額">
            <input
              type="number"
              required
              min="0"
              step="any"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={inputClass}
              placeholder="0"
            />
          </FormField>
          <FormField label="幣別">
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="類別">
          <select
            required
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={inputClass}
          >
            <option value="">請選擇類別</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>

        <FormField label="日期">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className={inputClass}
          />
        </FormField>

        <FormField label="備註">
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={inputClass}
            placeholder="選填"
          />
        </FormField>

        <button
          type="submit"
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          新增
        </button>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

export const inputClass =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export { Modal, FormField }
