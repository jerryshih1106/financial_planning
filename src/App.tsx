import { useEffect } from 'react'
import { useFinanceStore } from './store/useFinanceStore'
import Header from './components/Layout/Header'
import Navigation from './components/Layout/Navigation'
import FinancialList from './components/FinancialList'
import Charts from './components/Charts'
import Calculator from './components/Calculator'
import FirePlanning from './components/FirePlanning'

export default function App() {
  const { activeTab, settings } = useFinanceStore()

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [settings.theme])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Header />
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'list' && <FinancialList />}
        {activeTab === 'charts' && <Charts />}
        {activeTab === 'calculator' && <Calculator />}
        {activeTab === 'fire' && <FirePlanning />}
      </main>
    </div>
  )
}
