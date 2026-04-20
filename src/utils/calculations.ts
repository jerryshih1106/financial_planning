/**
 * 複利終值計算
 * FV = PV * (1 + r)^n + PMT * ((1 + r)^n - 1) / r
 */
export function calcFutureValue(
  presentValue: number,
  monthlyContribution: number,
  annualReturnRate: number,
  years: number
): number {
  const r = annualReturnRate / 100 / 12
  const n = years * 12
  if (r === 0) return presentValue + monthlyContribution * n
  const fv =
    presentValue * Math.pow(1 + r, n) +
    monthlyContribution * ((Math.pow(1 + r, n) - 1) / r)
  return fv
}

/**
 * 達到目標金額所需月數
 */
export function calcMonthsToGoal(
  currentAssets: number,
  monthlySavings: number,
  annualReturnRate: number,
  targetAmount: number
): number | null {
  if (currentAssets >= targetAmount) return 0
  const r = annualReturnRate / 100 / 12
  if (r === 0) {
    if (monthlySavings <= 0) return null
    return Math.ceil((targetAmount - currentAssets) / monthlySavings)
  }
  // 用牛頓法求解 n: PV*(1+r)^n + PMT*((1+r)^n-1)/r = Target
  // => (PV + PMT/r)*(1+r)^n = Target + PMT/r
  const pmtOverR = monthlySavings / r
  const ratio = (targetAmount + pmtOverR) / (currentAssets + pmtOverR)
  if (ratio <= 0) return null
  const n = Math.log(ratio) / Math.log(1 + r)
  return Math.ceil(n)
}

/**
 * FIRE 所需資產（4%法則）
 * FIRE Number = Annual Expense / SWR
 */
export function calcFireNumber(
  monthlyExpense: number,
  safeWithdrawalRate: number
): number {
  return (monthlyExpense * 12) / (safeWithdrawalRate / 100)
}

/**
 * 年金現值（貸款計算）
 * PMT = PV * r / (1 - (1+r)^-n)
 */
export function calcLoanPayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

/**
 * 生成未來 N 年的資產增長數列
 */
export function generateGrowthSeries(
  presentValue: number,
  monthlyContribution: number,
  annualReturnRate: number,
  years: number
): { year: number; value: number; contributed: number }[] {
  const series = []
  for (let y = 0; y <= years; y++) {
    const value = calcFutureValue(presentValue, monthlyContribution, annualReturnRate, y)
    const contributed = presentValue + monthlyContribution * y * 12
    series.push({ year: y, value: Math.round(value), contributed: Math.round(contributed) })
  }
  return series
}
