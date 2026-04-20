import { useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { CURRENCIES } from '../../types'
import { Modal, FormField, inputClass } from './TransactionForm'

const ASSET_TYPES = [
  { value: 'cash', label: '現金/存款' },
  { value: 'investment', label: '股票/基金' },
  { value: 'property', label: '房產' },
  { value: 'other', label: '其他' },
]

const LIABILITY_TYPES = [
  { value: 'loan', label: '個人貸款' },
  { value: 'mortgage', label: '房貸' },
  { value: 'credit', label: '信用卡' },
  { value: 'other', label: '其他' },
]

export default function AssetForm({
  type,
  onClose,
}: {
  type: 'asset' | 'liability'
  onClose: () => void
}) {
  const { addAsset, addLiability, settings } = useFinanceStore()
  const [form, setForm] = useState({
    name: '',
    value: '',
    currency: settings.currency,
    assetType: 'cash',
    liabilityType: 'loan',
    rate: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.value) return
    if (type === 'asset') {
      addAsset({
        name: form.name,
        value: parseFloat(form.value),
        currency: form.currency,
        type: form.assetType as 'cash' | 'investment' | 'property' | 'other',
        annualReturn: form.rate ? parseFloat(form.rate) : undefined,
      })
    } else {
      addLiability({
        name: form.name,
        amount: parseFloat(form.value),
        currency: form.currency,
        type: form.liabilityType as 'loan' | 'mortgage' | 'credit' | 'other',
        interestRate: form.rate ? parseFloat(form.rate) : undefined,
      })
    }
    onClose()
  }

  return (
    <Modal title={type === 'asset' ? '新增資產' : '新增負債'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="名稱">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
            placeholder={type === 'asset' ? '例：台積電股票' : '例：房屋貸款'}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={type === 'asset' ? '市值' : '餘額'}>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
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

        <FormField label="類型">
          <select
            value={type === 'asset' ? form.assetType : form.liabilityType}
            onChange={(e) =>
              setForm((f) =>
                type === 'asset'
                  ? { ...f, assetType: e.target.value }
                  : { ...f, liabilityType: e.target.value }
              )
            }
            className={inputClass}
          >
            {(type === 'asset' ? ASSET_TYPES : LIABILITY_TYPES).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label={type === 'asset' ? '年化報酬率 (%)' : '年利率 (%)'}>
          <input
            type="number"
            step="0.1"
            value={form.rate}
            onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
            className={inputClass}
            placeholder="選填，例：7"
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
