import { LayoutList, BarChart2, Calculator, Target } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import type { Tab } from '../../types'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'list', label: '財務列表', icon: <LayoutList size={20} /> },
  { id: 'charts', label: '視覺化圖表', icon: <BarChart2 size={20} /> },
  { id: 'calculator', label: '未來試算', icon: <Calculator size={20} /> },
  { id: 'fire', label: '財富自由', icon: <Target size={20} /> },
]

export default function Navigation() {
  const { activeTab, setActiveTab } = useFinanceStore()

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
