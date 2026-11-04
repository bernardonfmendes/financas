import type { Transaction } from '../transactions/transactionsService'

export type ReportPeriod = 'mes' | 'mes_anterior' | 'ano' | 'tudo'

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'ano', label: 'Este ano' },
  { value: 'tudo', label: 'Tudo' },
]

export interface PeriodRange {
  start: Date
  /** Fim exclusivo. */
  end: Date
  label: string
  /** Dias já decorridos no período (para a média diária). */
  days: number
}

const DAY_MS = 86_400_000

export function periodRange(period: ReportPeriod, transactions: Transaction[], now = new Date()): PeriodRange {
  const year = now.getFullYear()
  const month = now.getMonth()

  if (period === 'mes') {
    const start = new Date(year, month, 1)
    return {
      start,
      end: new Date(year, month + 1, 1),
      label: start.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
      days: now.getDate(),
    }
  }

  if (period === 'mes_anterior') {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    return {
      start,
      end,
      label: start.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
      days: Math.round((end.getTime() - start.getTime()) / DAY_MS),
    }
  }

  if (period === 'ano') {
    const start = new Date(year, 0, 1)
    return {
      start,
      end: new Date(year + 1, 0, 1),
      label: String(year),
      days: Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1,
    }
  }

  // Tudo: desde o primeiro movimento até hoje.
  const earliest = transactions.reduce<Date | null>((min, transaction) => {
    const date = new Date(transaction.occurred_at)
    return min === null || date < min ? date : min
  }, null)
  const start = earliest ?? now
  return {
    start: new Date(start.getFullYear(), start.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    label: 'Todo o histórico',
    days: Math.max(1, Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1),
  }
}

/** Movimentos pagos (não previstos) dentro do período e, se indicada, de uma categoria. */
export function paidInPeriod(
  transactions: Transaction[],
  range: PeriodRange,
  categoryId: string | null,
): Transaction[] {
  return transactions.filter((transaction) => {
    if (transaction.status !== 'paga') return false
    if (categoryId && transaction.category_id !== categoryId) return false
    const date = new Date(transaction.occurred_at)
    return date >= range.start && date < range.end
  })
}

export interface Summary {
  income: number
  expenses: number
  savings: number
  avgDaily: number
  avgMonthly: number
}

/** Totais do período. Transferências não contam como rendimento nem despesa. */
export function summarize(list: Transaction[], range: PeriodRange): Summary {
  let income = 0
  let expenses = 0
  const months = new Set<string>()

  for (const transaction of list) {
    if (transaction.kind === 'rendimento') income += transaction.amount_cents
    if (transaction.kind === 'despesa') expenses += transaction.amount_cents
    if (transaction.kind !== 'transferencia') {
      const date = new Date(transaction.occurred_at)
      months.add(`${date.getFullYear()}-${date.getMonth()}`)
    }
  }

  return {
    income,
    expenses,
    savings: income - expenses,
    avgDaily: range.days > 0 ? Math.round(expenses / range.days) : 0,
    avgMonthly: Math.round(expenses / Math.max(1, months.size)),
  }
}

export interface CategoryTotal {
  id: string | null
  name: string
  amount: number
  percent: number
}

export function expensesByCategory(
  list: Transaction[],
  categoryNames: Map<string, string>,
): CategoryTotal[] {
  const totals = new Map<string | null, number>()
  let total = 0

  for (const transaction of list) {
    if (transaction.kind !== 'despesa') continue
    const key = transaction.category_id
    totals.set(key, (totals.get(key) ?? 0) + transaction.amount_cents)
    total += transaction.amount_cents
  }

  return [...totals.entries()]
    .map(([id, amount]) => ({
      id,
      name: id ? (categoryNames.get(id) ?? 'Sem nome') : 'Sem categoria',
      amount,
      percent: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function topExpenses(list: Transaction[], count = 5): Transaction[] {
  return list
    .filter((transaction) => transaction.kind === 'despesa')
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, count)
}

export interface MonthPoint {
  key: string
  label: string
  income: number
  expenses: number
}

/** Últimos 12 meses terminados no mês atual (inclusive). */
export function monthlySeries(transactions: Transaction[], categoryId: string | null, now = new Date()): MonthPoint[] {
  const points: MonthPoint[] = []

  for (let offset = 11; offset >= 0; offset--) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1)
    const point: MonthPoint = {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
      income: 0,
      expenses: 0,
    }

    for (const transaction of transactions) {
      if (transaction.status !== 'paga') continue
      if (categoryId && transaction.category_id !== categoryId) continue
      const date = new Date(transaction.occurred_at)
      if (date < start || date >= end) continue
      if (transaction.kind === 'rendimento') point.income += transaction.amount_cents
      if (transaction.kind === 'despesa') point.expenses += transaction.amount_cents
    }

    points.push(point)
  }

  return points
}

export interface YearPoint {
  year: number
  income: number
  expenses: number
}

/** Totais por ano, com categoria opcional. */
export function yearlySeries(transactions: Transaction[], categoryId: string | null): YearPoint[] {
  const years = new Map<number, YearPoint>()

  for (const transaction of transactions) {
    if (transaction.status !== 'paga') continue
    if (categoryId && transaction.category_id !== categoryId) continue
    if (transaction.kind === 'transferencia') continue

    const year = new Date(transaction.occurred_at).getFullYear()
    const point = years.get(year) ?? { year, income: 0, expenses: 0 }
    if (transaction.kind === 'rendimento') point.income += transaction.amount_cents
    if (transaction.kind === 'despesa') point.expenses += transaction.amount_cents
    years.set(year, point)
  }

  return [...years.values()].sort((a, b) => a.year - b.year)
}
