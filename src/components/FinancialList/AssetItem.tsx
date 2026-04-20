import { Trash2, Landmark, TrendingUp, Home, HelpCircle, CreditCard } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency } from '../../utils/currency'
import type { Asset, Liability } from '../../types'

const ASSET_ICONS = {
  cash: <Landmark size={16} className="text-blue-500" />,
  investment: <TrendingUp size={16} className="text-purple-500" />,
  property: <Home size={16} className="text-orange-500" />,
  other: <HelpCircle size={16} className="text-gray-400" />,
}

const LIABILITY_ICONS = {
  loan: <CreditCard size={16} className="text-red-400" />,
  mortgage: <Home size={16} className="text-red-500" />,
  credit: <CreditCard size={16} className="text-orange-400" />,
  other: <HelpCircle size={16} className="text-gray-400" />,
}

export default function AssetItem({
  item,
  currency,
  type,
}: {
  item: Asset | Liability
  currency: string
  type: 'asset' | 'liability'
}) {
  const { deleteAsset, deleteLiability } = useFinanceStore()
  const isAsset = type === 'asset'
  const value = isAsset ? (item as Asset).value : (item as Liability).amount
  const itemType = isAsset ? (item as Asset).type : (item as Liability).type
  const rate = isAsset ? (item as Asset).annualReturn : (item as Liability).interestRate

  const icon = isAsset
    ? ASSET_ICONS[itemType as keyof typeof ASSET_ICONS]
    : LIABILITY_ICONS[itemType as keyof typeof LIABILITY_ICONS]

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
        {rate !== undefined && (
          <p className="text-xs text-gray-400">
            {isAsset ? '年化報酬' : '年利率'}：{rate}%
          </p>
        )}
      </div>

      <p className={`text-sm font-semibold flex-shrink-0 ${
        isAsset ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'
      }`}>
        {formatCurrency(value, item.currency || currency)}
      </p>

      <button
        onClick={() => isAsset ? deleteAsset(item.id) : deleteLiability(item.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
