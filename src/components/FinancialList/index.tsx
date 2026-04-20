import { useState } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, Building2 } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency, formatLargeNumber } from '../../utils/currency'
import TransactionForm from './TransactionForm'
import AssetForm from './AssetForm'
import TransactionItem from './TransactionItem'
import AssetItem from './AssetItem'

type SubTab = 'transactions' | 'assets' | 'liabilities'

export default function FinancialList() {
  const [subTab, setSubTab] = useState<SubTab>('transactions')
  const [showTxForm, setShowTxForm] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [showLiabilityForm, setShowLiabilityForm] = useState(false)

  const { transactions, assets, liabilities, settings } = useFinanceStore()
  const currency = settings.currency

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0)
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0)
  const netWorth = totalAssets - totalLiabilities

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'transactions', label: '收支記錄' },
    { id: 'assets', label: '資產' },
    { id: 'liabilities', label: '負債' },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="總收入"
          value={formatLargeNumber(totalIncome, currency)}
          icon={<TrendingUp size={20} className="text-green-500" />}
          color="green"
        />
        <SummaryCard
          title="總支出"
          value={formatLargeNumber(totalExpense, currency)}
          icon={<TrendingDown size={20} className="text-red-500" />}
          color="red"
        />
        <SummaryCard
          title="總資產"
          value={formatLargeNumber(totalAssets, currency)}
          icon={<Building2 size={20} className="text-blue-500" />}
          color="blue"
        />
        <SummaryCard
          title="淨資產"
          value={formatLargeNumber(netWorth, currency)}
          icon={<Wallet size={20} className={netWorth >= 0 ? 'text-purple-500' : 'text-orange-500'} />}
          color={netWorth >= 0 ? 'purple' : 'orange'}
        />
      </div>

      {/* Sub Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-4">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                subTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {subTab === 'transactions' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  共 {transactions.length} 筆記錄
                </p>
                <button
                  onClick={() => setShowTxForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} /> 新增記錄
                </button>
              </div>
              {transactions.length === 0 ? (
                <EmptyState message="尚無收支記錄，點擊新增開始記帳" />
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <TransactionItem key={tx.id} transaction={tx} currency={currency} />
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'assets' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  總資產：{formatCurrency(totalAssets, currency)}
                </p>
                <button
                  onClick={() => setShowAssetForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} /> 新增資產
                </button>
              </div>
              {assets.length === 0 ? (
                <EmptyState message="尚無資產記錄，點擊新增" />
              ) : (
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <AssetItem key={asset.id} item={asset} currency={currency} type="asset" />
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'liabilities' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  總負債：{formatCurrency(totalLiabilities, currency)}
                </p>
                <button
                  onClick={() => setShowLiabilityForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} /> 新增負債
                </button>
              </div>
              {liabilities.length === 0 ? (
                <EmptyState message="尚無負債記錄，點擊新增" />
              ) : (
                <div className="space-y-2">
                  {liabilities.map((liability) => (
                    <AssetItem key={liability.id} item={liability} currency={currency} type="liability" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} />}
      {showAssetForm && <AssetForm type="asset" onClose={() => setShowAssetForm(false)} />}
      {showLiabilityForm && <AssetForm type="liability" onClose={() => setShowLiabilityForm(false)} />}
    </div>
  )
}

function SummaryCard({
  title, value, icon, color,
}: {
  title: string
  value: string
  icon: React.ReactNode
  color: 'green' | 'red' | 'blue' | 'purple' | 'orange'
}) {
  const bg = {
    green: 'bg-green-50 dark:bg-green-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
    orange: 'bg-orange-50 dark:bg-orange-900/20',
  }[color]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-gray-400 dark:text-gray-600">
      <p className="text-sm">{message}</p>
    </div>
  )
}
