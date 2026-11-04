import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatEUR, parseEurToCents } from '../../lib/money'
import { fetchCategories, type Category } from '../accounts/accountsService'
import { useAccounts } from '../accounts/useAccounts'
import { fetchTransactions, type Transaction } from '../transactions/transactionsService'
import { deleteBudget, fetchBudgets, saveBudget, type Budget } from './budgetsService'
import { RecurringSection } from './RecurringSection'
import { fetchRules, generatePlannedOccurrences, markPlannedAsPaid, type RecurringRule } from './recurringService'

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function shortDate(day: string | null): string {
  if (!day) return ''
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return new Date(year, month - 1, dayOfMonth).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
  })
}

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

export function BudgetsScreen() {
  const { accounts, loading: accountsLoading } = useAccounts()
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [alertInput, setAlertInput] = useState('80')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Primeiro cria as previstas em falta, depois lê tudo para o ecrã ficar atualizado.
      const currentRules = await fetchRules()
      await generatePlannedOccurrences(currentRules)

      const [categoryList, budgetList, transactionList, ruleList] = await Promise.all([
        fetchCategories(),
        fetchBudgets(),
        fetchTransactions(),
        fetchRules(),
      ])

      setCategories(categoryList)
      setBudgets(budgetList)
      setTransactions(transactionList)
      setRules(ruleList)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const spentByCategory = useMemo(() => {
    const monthStart = startOfMonth()
    const totals = new Map<string, number>()

    for (const transaction of transactions) {
      if (transaction.status !== 'paga' || transaction.kind !== 'despesa' || !transaction.category_id) continue
      if (new Date(transaction.occurred_at) < monthStart) continue
      totals.set(transaction.category_id, (totals.get(transaction.category_id) ?? 0) + transaction.amount_cents)
    }

    return totals
  }, [transactions])

  const budgetByCategory = useMemo(
    () => new Map<string, Budget>(budgets.map((budget): [string, Budget] => [budget.category_id, budget])),
    [budgets],
  )

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'despesa'),
    [categories],
  )

  const planned = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.status === 'prevista')
        .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
    [transactions],
  )

  const categoryNames = useMemo(
    () => new Map<string, string>(categories.map((category): [string, string] => [category.id, category.name])),
    [categories],
  )

  /** Categorias que já atingiram a percentagem de alerta (ou passaram o limite), as mais graves primeiro. */
  const alerts = useMemo(() => {
    const list: { id: string; name: string; percent: number; spent: number; limit: number }[] = []

    for (const budget of budgets) {
      const spent = spentByCategory.get(budget.category_id) ?? 0
      const percent = Math.round((spent / budget.amount_cents) * 100)
      if (percent >= budget.alert_percent) {
        list.push({
          id: budget.id,
          name: categoryNames.get(budget.category_id) ?? 'Categoria',
          percent,
          spent,
          limit: budget.amount_cents,
        })
      }
    }

    return list.sort((a, b) => b.percent - a.percent)
  }, [budgets, spentByCategory, categoryNames])

  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount_cents, 0)
  const totalSpent = budgets.reduce((sum, budget) => sum + (spentByCategory.get(budget.category_id) ?? 0), 0)

  function startEditing(category: Category) {
    const existing = budgetByCategory.get(category.id)
    setError(null)
    setEditingId(category.id)
    setAmountInput(existing ? centsToInput(existing.amount_cents) : '')
    setAlertInput(String(existing?.alert_percent ?? 80))
  }

  async function handleSave(categoryId: string) {
    setError(null)

    const cents = parseEurToCents(amountInput)
    if (cents === null || cents <= 0) {
      setError('Indica um valor de orçamento maior que zero.')
      return
    }

    const alert = Number(alertInput)
    if (!Number.isInteger(alert) || alert < 1 || alert > 100) {
      setError('O alerta deve estar entre 1 e 100%.')
      return
    }

    setSaving(true)
    try {
      await saveBudget(categoryId, cents, alert)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(budget: Budget) {
    if (!window.confirm('Remover o orçamento desta categoria?')) return

    setError(null)
    try {
      await deleteBudget(budget.id)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function handleMarkPaid(transaction: Transaction) {
    setError(null)
    try {
      await markPlannedAsPaid(transaction.id)
      await load()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  return (
    <section aria-labelledby="titulo-orcamentos" className="space-y-8">
      <header>
        <h1 id="titulo-orcamentos" className="text-3xl font-semibold tracking-tight">
          Orçamentos
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Orçamentos deste mês.</p>
      </header>

      {alerts.length > 0 && (
        <section aria-label="Alertas de orçamento" className="space-y-2">
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
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">Gasto de orçamentos definidos</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {formatEUR(totalSpent)} <span className="text-base font-normal text-slate-500 dark:text-slate-400">de {formatEUR(totalBudgeted)}</span>
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>}

      <section aria-labelledby="titulo-categorias-orcamento" className="space-y-3">
        <h2 id="titulo-categorias-orcamento" className="text-xl font-semibold tracking-tight">Por categoria</h2>
        <ul className="space-y-3">
          {expenseCategories.map((category) => {
            const budget = budgetByCategory.get(category.id)
            const spent = spentByCategory.get(category.id) ?? 0
            const percent = budget ? Math.round((spent / budget.amount_cents) * 100) : 0
            const barColor =
              !budget ? '' : percent >= 100 ? 'bg-red-500' : percent >= budget.alert_percent ? 'bg-amber-500' : 'bg-brand-600'
            const isEditing = editingId === category.id

            return (
              <li key={category.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <button
                  type="button"
                  onClick={() => (isEditing ? setEditingId(null) : startEditing(category))}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{category.icon} {category.name}</p>
                    {budget ? (
                      <p className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                        {formatEUR(spent)} / {formatEUR(budget.amount_cents)}
                      </p>
                    ) : (
                      <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Definir orçamento</p>
                    )}
                  </div>

                  {budget && (
                    <>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100}>
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {percent}% utilizado · {budget.amount_cents - spent >= 0
                          ? `disponível ${formatEUR(budget.amount_cents - spent)}`
                          : `excedido em ${formatEUR(spent - budget.amount_cents)}`}
                      </p>
                    </>
                  )}
                </button>

                {isEditing && (
                  <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <div>
                      <label htmlFor={`orc-${category.id}`} className="text-sm font-medium">Limite mensal (€)</label>
                      <input id={`orc-${category.id}`} type="text" inputMode="decimal" placeholder="0,00" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor={`alerta-${category.id}`} className="text-sm font-medium">Alertar aos (%)</label>
                      <input id={`alerta-${category.id}`} type="number" min={1} max={100} value={alertInput} onChange={(e) => setAlertInput(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex gap-3">
                      {budget && (
                        <button type="button" onClick={() => void handleRemove(budget)} className="flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-300 dark:text-red-400 dark:ring-red-900">
                          Remover
                        </button>
                      )}
                      <button type="button" disabled={saving} onClick={() => void handleSave(category.id)} className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'A guardar…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="titulo-previstas" className="space-y-3">
        <h2 id="titulo-previstas" className="text-xl font-semibold tracking-tight">Previstas</h2>
        {planned.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Não há despesas previstas nos próximos dias.</p>
        )}
        <ul className="space-y-3">
          {planned.map((transaction) => (
            <li key={transaction.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <div className="min-w-0">
                <p className="truncate font-medium">{transaction.description}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  Prevista para {shortDate(transaction.due_date)}
                  {transaction.category_id ? ` · ${categoryNames.get(transaction.category_id) ?? ''}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums font-medium">{formatEUR(transaction.amount_cents)}</p>
                <button type="button" onClick={() => void handleMarkPaid(transaction)} className="mt-1 text-sm font-medium text-brand-600 dark:text-brand-500">
                  Marcar como paga
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {!accountsLoading && (
        <RecurringSection
          accounts={accounts}
          categories={categories}
          rules={rules}
          onChanged={() => void load()}
        />
      )}
    </section>
  )
}
