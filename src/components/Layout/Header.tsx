import { useState } from 'react'
import { Moon, Sun, TrendingUp, FolderUp } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { CURRENCIES } from '../../types'
import ImportExportModal from '../ImportExport'

export default function Header() {
  const { settings, updateSettings } = useFinanceStore()
  const isDark = settings.theme === 'dark'
  const [showImportExport, setShowImportExport] = useState(false)

  const toggleTheme = () =>
    updateSettings({ theme: isDark ? 'light' : 'dark' })

  return (
    <>
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">財務規劃</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Selector */}
            <select
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5
                         bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </select>

            {/* Import / Export */}
            <button
              onClick={() => setShowImportExport(true)}
              title="匯入 / 匯出資料"
              className="w-9 h-9 rounded-lg flex items-center justify-center
                         bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300
                         hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <FolderUp size={18} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? '切換淺色模式' : '切換深色模式'}
              className="w-9 h-9 rounded-lg flex items-center justify-center
                         bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300
                         hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} />
      )}
    </>
  )
}
