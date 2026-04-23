import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction, Asset, Liability, StockPosition, Settings, FireSettings, Tab } from '../types'
import type { Rates } from '../utils/exchangeRate'

interface FinanceStore {
  // State
  transactions: Transaction[]
  assets: Asset[]
  liabilities: Liability[]
  stockPositions: StockPosition[]
  settings: Settings
  fireSettings: FireSettings
  activeTab: Tab
  exchangeRates: Rates

  // Actions - Transactions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void
  updateTransaction: (id: string, tx: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void

  // Actions - Assets
  addAsset: (asset: Omit<Asset, 'id'>) => void
  updateAsset: (id: string, asset: Partial<Asset>) => void
  deleteAsset: (id: string) => void

  // Actions - Liabilities
  addLiability: (liability: Omit<Liability, 'id'>) => void
  updateLiability: (id: string, liability: Partial<Liability>) => void
  deleteLiability: (id: string) => void

  // Actions - Stocks
  addStockPosition: (pos: Omit<StockPosition, 'id'>) => void
  updateStockPosition: (id: string, pos: Partial<StockPosition>) => void
  deleteStockPosition: (id: string) => void

  // Actions - Settings
  updateSettings: (settings: Partial<Settings>) => void
  updateFireSettings: (settings: Partial<FireSettings>) => void
  setActiveTab: (tab: Tab) => void
  setExchangeRates: (rates: Rates) => void
}

const defaultFireSettings: FireSettings = {
  monthlyExpense: 50000,
  currency: 'TWD',
  currentAssets: 1000000,
  monthlySavings: 30000,
  expectedReturn: 7,
  safeWithdrawalRate: 4,
  currentAge: 30,
  targetRetirementAge: 50,
  useCustomTarget: false,
  customTargetAmount: 30000000,
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      transactions: [],
      assets: [],
      liabilities: [],
      stockPositions: [],
      settings: { currency: 'TWD', theme: 'light' },
      fireSettings: defaultFireSettings,
      activeTab: 'list',
      exchangeRates: { USD: 1, TWD: 32.5, EUR: 0.92, JPY: 154, GBP: 0.79, CNY: 7.24, HKD: 7.83, SGD: 1.35 },

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [{ ...tx, id: uuidv4() }, ...state.transactions],
        })),
      updateTransaction: (id, tx) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...tx } : t
          ),
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      addAsset: (asset) =>
        set((state) => ({
          assets: [{ ...asset, id: uuidv4() }, ...state.assets],
        })),
      updateAsset: (id, asset) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, ...asset } : a
          ),
        })),
      deleteAsset: (id) =>
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
        })),

      addLiability: (liability) =>
        set((state) => ({
          liabilities: [{ ...liability, id: uuidv4() }, ...state.liabilities],
        })),
      updateLiability: (id, liability) =>
        set((state) => ({
          liabilities: state.liabilities.map((l) =>
            l.id === id ? { ...l, ...liability } : l
          ),
        })),
      deleteLiability: (id) =>
        set((state) => ({
          liabilities: state.liabilities.filter((l) => l.id !== id),
        })),

      addStockPosition: (pos) =>
        set((state) => ({
          stockPositions: [{ ...pos, id: uuidv4() }, ...state.stockPositions],
        })),
      updateStockPosition: (id, pos) =>
        set((state) => ({
          stockPositions: state.stockPositions.map((p) =>
            p.id === id ? { ...p, ...pos } : p
          ),
        })),
      deleteStockPosition: (id) =>
        set((state) => ({
          stockPositions: state.stockPositions.filter((p) => p.id !== id),
        })),

      updateSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),
      updateFireSettings: (settings) =>
        set((state) => ({
          fireSettings: { ...state.fireSettings, ...settings },
        })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setExchangeRates: (rates) => set({ exchangeRates: rates }),
    }),
    { name: 'financial-planning-store' }
  )
)
