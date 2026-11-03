import { useState } from 'react'
import { formatEUR } from '../../lib/money'
import { accountTypeLabel } from './accountTypes'
import { AccountForm } from './AccountForm'
import { CategoriesSection } from './CategoriesSection'
import type { Account } from './accountsService'
import { useAccounts } from './useAccounts'

type Editing = Account | 'new' | null

export function AccountsScreen() {
  const { accounts, loading, error, reload } = useAccounts()
  const [editing, setEditing] = useState<Editing>(null)

  if (editing !== null) {
    const isNew = editing === 'new'

    return (
      <section aria-labelledby="titulo-editar-conta" className="space-y-8">
        <h1 id="titulo-editar-conta" className="text-3xl font-semibold tracking-tight">
          {isNew ? 'Nova conta' : 'Editar conta'}
        </h1>
        <AccountForm
          initial={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            void reload()
          }}
          onCancel={() => setEditing(null)}
        />
      </section>
    )
  }

  const total = accounts.reduce((sum, account) => sum + account.opening_balance_cents, 0)

  return (
    <section aria-labelledby="titulo-contas" className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <h1 id="titulo-contas" className="text-3xl font-semibold tracking-tight">
          Contas
        </h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="mt-1 shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Nova conta
        </button>
      </header>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">Total em contas</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{formatEUR(total)}</p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Soma dos saldos iniciais.</p>
      </div>

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && accounts.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ainda não tens contas. Cria a primeira.
        </p>
      )}

      {accounts.length > 0 && (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => setEditing(account)}
                className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
              >
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {accountTypeLabel(account.account_type)}
                </p>
                <p className="mt-2 tabular-nums">{formatEUR(account.opening_balance_cents)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CategoriesSection />
    </section>
  )
}
