import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatEUR } from '../../lib/money'
import { fetchCategories, type Category } from '../accounts/accountsService'
import { useAccounts } from '../accounts/useAccounts'
import { TransactionForm } from './TransactionForm'
import {
  deleteTransaction,
  fetchTransactions,
  type Transaction,
} from './transactionsService'

type View =
  | { mode: 'lista' }
  | { mode: 'criar'; base: Transaction | null }
  | { mode: 'editar'; transaction: Transaction }

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
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

export function TransactionsScreen() {
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ mode: 'lista' })

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

  const accountNames = useMemo(
    () => new Map<string, string>(accounts.map((account): [string, string] => [account.id, account.name])),
    [accounts],
  )

  const categoryNames = useMemo(
    () => new Map<string, string>(categories.map((category): [string, string] => [category.id, category.name])),
    [categories],
  )

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()

    for (const transaction of transactions) {
      const key = localDayKey(transaction.occurred_at)
      const list = byDay.get(key) ?? []
      list.push(transaction)
      byDay.set(key, list)
    }

    return [...byDay.entries()]
  }, [transactions])

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
    <section aria-labelledby="titulo-movimentos" className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <h1 id="titulo-movimentos" className="text-3xl font-semibold tracking-tight">
          Movimentos
        </h1>
        <button
          type="button"
          onClick={() => setView({ mode: 'criar', base: null })}
          disabled={!hasAccounts}
          className="mt-1 shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Novo movimento
        </button>
      </header>

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

      {!loading && !error && transactions.length === 0 && hasAccounts && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não tens movimentos.</p>
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
