import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatEUR } from '../../lib/money'
import { fetchCategories, type Category } from '../accounts/accountsService'
import { useAccounts } from '../accounts/useAccounts'
import { QuickEntry } from './QuickEntry'
import { TransactionForm } from './TransactionForm'
import {
  deleteTransaction,
  fetchTransactions,
  type Transaction,
} from './transactionsService'

type View =
  | { mode: 'lista' }
  | { mode: 'rapido' }
  | { mode: 'criar'; base: Transaction | null }
  | { mode: 'editar'; transaction: Transaction }

type Period = 'hoje' | 'semana' | 'mes' | 'tudo'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'tudo', label: 'Tudo' },
]

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
}

/** Início do período escolhido (null = sem limite). A semana começa à segunda-feira. */
function periodStart(period: Period): Date | null {
  const now = new Date()

  if (period === 'hoje') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'semana') {
    const daysSinceMonday = (now.getDay() + 6) % 7
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday)
  }
  if (period === 'mes') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return null
}

/** Data local no formato AAAA-MM-DD, usada para agrupar por dia. */
function localDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function dayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function amountClass(kind: Transaction['kind']): string {
  if (kind === 'rendimento') return 'text-emerald-600 dark:text-emerald-400'
  if (kind === 'transferencia') return 'text-slate-500 dark:text-slate-400'
  return 'text-slate-900 dark:text-slate-100'
}

function amountText(transaction: Transaction): string {
  const value = formatEUR(transaction.amount_cents)
  if (transaction.kind === 'rendimento') return `+ ${value}`
  if (transaction.kind === 'despesa') return `− ${value}`
  return value
}

interface TransactionsScreenProps {
  /** true quando a app foi aberta com ?novo=1 (atalho do iPhone): abre logo o registo rápido. */
  startInQuickEntry?: boolean
  /** Chamado uma vez, ao abrir o registo rápido pedido pelo atalho. */
  onQuickEntryStarted?: () => void
}

export function TransactionsScreen({
  startInQuickEntry = false,
  onQuickEntryStarted,
}: TransactionsScreenProps) {
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('mes')
  const [view, setView] = useState<View>(
    startInQuickEntry ? { mode: 'rapido' } : { mode: 'lista' },
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [transactionList, categoryList] = await Promise.all([
        fetchTransactions(),
        fetchCategories(),
      ])
      setTransactions(transactionList)
      setCategories(categoryList)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (startInQuickEntry) onQuickEntryStarted?.()
    // Só na montagem: o pedido do atalho é consumido uma única vez.
  }, [])

  const accountNames = useMemo(
    () => new Map<string, string>(accounts.map((account): [string, string] => [account.id, account.name])),
    [accounts],
  )

  const categoryNames = useMemo(
    () => new Map<string, string>(categories.map((category): [string, string] => [category.id, category.name])),
    [categories],
  )

  const filtered = useMemo(() => {
    const start = periodStart(period)
    if (!start) return transactions
    return transactions.filter((transaction) => new Date(transaction.occurred_at) >= start)
  }, [transactions, period])

  const totals = useMemo(() => {
    let expenses = 0
    let income = 0

    for (const transaction of filtered) {
      if (transaction.kind === 'despesa') expenses += transaction.amount_cents
      if (transaction.kind === 'rendimento') income += transaction.amount_cents
    }

    return { expenses, income }
  }, [filtered])

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()

    for (const transaction of filtered) {
      const key = localDayKey(transaction.occurred_at)
      const list = byDay.get(key) ?? []
      list.push(transaction)
      byDay.set(key, list)
    }

    return [...byDay.entries()]
  }, [filtered])

  async function handleDelete(transaction: Transaction) {
    if (!window.confirm('Apagar este movimento? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      await deleteTransaction(transaction.id)
      setView({ mode: 'lista' })
      await load()
    } catch (err) {
      setView({ mode: 'lista' })
      setError(messageOf(err))
    }
  }

  if (view.mode === 'rapido') {
    if (loading || accountsLoading) {
      return <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>
    }

    return (
      <QuickEntry
        accounts={accounts}
        categories={categories}
        onSaved={() => {
          setView({ mode: 'lista' })
          void load()
        }}
        onAdvanced={() => setView({ mode: 'criar', base: null })}
        onCancel={() => setView({ mode: 'lista' })}
      />
    )
  }

  if (view.mode !== 'lista') {
    const editing = view.mode === 'editar' ? view.transaction : null
    const isEditing = editing !== null
    const initial = view.mode === 'editar' ? view.transaction : view.base

    return (
      <section aria-labelledby="titulo-movimento" className="space-y-8">
        <h1 id="titulo-movimento" className="text-3xl font-semibold tracking-tight">
          {isEditing ? 'Editar movimento' : 'Novo movimento'}
        </h1>

        <TransactionForm
          mode={isEditing ? 'editar' : 'criar'}
          initial={initial}
          accounts={accounts}
          categories={categories}
          onDone={() => {
            setView({ mode: 'lista' })
            void load()
          }}
          onCancel={() => setView({ mode: 'lista' })}
        />

        {editing && (
          <div className="flex gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setView({ mode: 'criar', base: editing })}
              className="flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 dark:text-slate-200 dark:ring-slate-700"
            >
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(editing)}
              className="flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-300 dark:text-red-400 dark:ring-red-900"
            >
              Apagar
            </button>
          </div>
        )}
      </section>
    )
  }

  const hasAccounts = accounts.length > 0

  return (
    <section aria-labelledby="titulo-movimentos" className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 id="titulo-movimentos" className="text-3xl font-semibold tracking-tight">
          Movimentos
        </h1>
        <button
          type="button"
          onClick={() => setView({ mode: 'rapido' })}
          disabled={!hasAccounts}
          className="mt-1 shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Registar
        </button>
      </header>

      <div role="radiogroup" aria-label="Período" className="flex gap-2 overflow-x-auto">
        {PERIODS.map((option) => {
          const selected = period === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPeriod(option.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-500 ring-1 ring-slate-200 dark:text-slate-400 dark:ring-slate-800'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Despesas</p>
          <p className="font-semibold tabular-nums">{formatEUR(totals.expenses)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Rendimentos</p>
          <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatEUR(totals.income)}
          </p>
        </div>
      </div>

      {!accountsLoading && !hasAccounts && !accountsError && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Antes de registar movimentos, cria uma conta no separador Contas.
        </p>
      )}

      {(error || accountsError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error ?? accountsError}
        </p>
      )}

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>}

      {!loading && !error && filtered.length === 0 && hasAccounts && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {transactions.length === 0
            ? 'Ainda não tens movimentos.'
            : 'Não há movimentos neste período.'}
        </p>
      )}

      {groups.map(([dayKey, dayTransactions]) => (
        <div key={dayKey} className="space-y-3">
          <h2 className="text-sm font-medium capitalize text-slate-500 dark:text-slate-400">
            {dayLabel(dayKey)}
          </h2>
          <ul className="space-y-3">
            {dayTransactions.map((transaction) => {
              const accountName = accountNames.get(transaction.account_id) ?? 'Conta removida'
              const subtitle =
                transaction.kind === 'transferencia'
                  ? `${accountName} → ${accountNames.get(transaction.to_account_id ?? '') ?? 'Conta removida'}`
                  : `${accountName} · ${
                      transaction.category_id
                        ? (categoryNames.get(transaction.category_id) ?? 'Sem categoria')
                        : 'Sem categoria'
                    }`

              return (
                <li key={transaction.id}>
                  <button
                    type="button"
                    onClick={() => setView({ mode: 'editar', transaction })}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{transaction.description}</p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {subtitle} · {timeLabel(transaction.occurred_at)}
                      </p>
                    </div>
                    <p className={`shrink-0 tabular-nums font-medium ${amountClass(transaction.kind)}`}>
                      {amountText(transaction)}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
