export type TransactionType = 'income' | 'expense'

export type AssetType = 'cash' | 'investment' | 'property' | 'other'

export type LiabilityType = 'loan' | 'mortgage' | 'credit' | 'other'

export interface Transaction {
  id: string
  type: TransactionType
  category: string
  amount: number
  currency: string
  date: string
  description: string
}

export interface Asset {
  id: string
  name: string
  value: number
  currency: string
  type: AssetType
  annualReturn?: number
}

export interface Liability {
  id: string
  name: string
  amount: number
  currency: string
  type: LiabilityType
  interestRate?: number
}

export interface Settings {
  currency: string
  theme: 'light' | 'dark'
}

export interface FireSettings {
  monthlyExpense: number
  currency: string
  currentAssets: number
  monthlySavings: number
  expectedReturn: number
  safeWithdrawalRate: number
  currentAge: number
  targetRetirementAge: number
}

export type Tab = 'list' | 'charts' | 'calculator' | 'fire'

export const CURRENCIES = [
  { code: 'TWD', symbol: 'NT$', name: '台幣' },
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '歐元' },
  { code: 'JPY', symbol: '¥', name: '日圓' },
  { code: 'GBP', symbol: '£', name: '英鎊' },
  { code: 'CNY', symbol: '¥', name: '人民幣' },
  { code: 'HKD', symbol: 'HK$', name: '港幣' },
  { code: 'SGD', symbol: 'S$', name: '新加坡幣' },
]

export const EXPENSE_CATEGORIES = [
  '餐飲', '交通', '住房', '娛樂', '醫療', '教育', '購物', '保險', '其他'
]

export const INCOME_CATEGORIES = [
  '薪資', '投資收益', '副業', '租金收入', '獎金', '其他'
]
