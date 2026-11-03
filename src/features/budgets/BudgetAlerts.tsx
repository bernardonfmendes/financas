import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatEUR } from '../../lib/money'
import { fetchCategories, type Category } from '../accounts/accountsService'
import { fetchTransactions, type Transaction } from '../transactions/transactionsService'
import { fetchBudgets, type Budget } from './budgetsService'

function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Avisos dos orçamentos do Início: aparecem assim que a categoria atinge a percentagem de alerta. */
export function BudgetAlerts() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const load = useCallback(async () => {
    try {
      const [budgetList, transactionList, categoryList] = await Promise.all([
        fetchBudgets(),
        fetchTransactions(),
        fetchCategories(),
      ])
      setBudgets(budgetList)
      setTransactions(transactionList)
      setCategories(categoryList)
    } catch {
      // Sem avisos se os dados não carregarem: o resto do Início continua a funcionar.
      setBudgets([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function reloadWhenVisible() {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', reloadWhenVisible)
    return () => document.removeEventListener('visibilitychange', reloadWhenVisible)
  }, [load])

  const alerts = useMemo(() => {
    const monthStart = startOfMonth()
    const spent = new Map<string, number>()

    for (const transaction of transactions) {
      if (transaction.status !== 'paga' || transaction.kind !== 'despesa' || !transaction.category_id) continue
      if (new Date(transaction.occurred_at) < monthStart) continue
      spent.set(transaction.category_id, (spent.get(transaction.category_id) ?? 0) + transaction.amount_cents)
    }

    const names = new Map<string, string>(
      categories.map((category): [string, string] => [category.id, category.name]),
    )

    const list: { id: string; name: string; percent: number; spent: number; limit: number }[] = []

    for (const budget of budgets) {
      const spentCents = spent.get(budget.category_id) ?? 0
      const percent = Math.round((spentCents / budget.amount_cents) * 100)
      if (percent >= budget.alert_percent) {
        list.push({
          id: budget.id,
          name: names.get(budget.category_id) ?? 'Categoria',
          percent,
          spent: spentCents,
          limit: budget.amount_cents,
        })
      }
    }

    return list.sort((a, b) => b.percent - a.percent)
  }, [budgets, transactions, categories])

  if (alerts.length === 0) return null

  return (
    <section aria-label="Alertas de orçamento" className="space-y-2">
      <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Orçamentos</h2>
      {alerts.map((alert) => (
        <p
          key={alert.id}
          role="alert"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            alert.percent >= 100
              ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          {alert.percent >= 100
            ? `${alert.name}: orçamento ultrapassado em ${formatEUR(alert.spent - alert.limit)}.`
            : `${alert.name}: já usaste ${alert.percent}% do orçamento (${formatEUR(alert.limit - alert.spent)} disponíveis).`}
        </p>
      ))}
    </section>
  )
}
