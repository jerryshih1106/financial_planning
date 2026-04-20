import { Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency } from '../../utils/currency'
import type { Transaction } from '../../types'

export default function TransactionItem({
  transaction,
  currency,
}: {
  transaction: Transaction
  currency: string
}) {
  const { deleteTransaction } = useFinanceStore()
  const isIncome = transaction.type === 'income'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
        }`}
      >
        {isIncome ? (
          <TrendingUp size={16} className="text-green-600" />
        ) : (
          <TrendingDown size={16} className="text-red-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {transaction.category}
          </span>
          {transaction.description && (
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
              · {transaction.description}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{transaction.date}</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p
          className={`text-sm font-semibold ${
            isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
          }`}
        >
          {isIncome ? '+' : '-'}
          {formatCurrency(transaction.amount, transaction.currency || currency)}
        </p>
      </div>

      <button
        onClick={() => deleteTransaction(transaction.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
