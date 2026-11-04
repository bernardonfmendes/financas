import { useState } from 'react'
import { formatEUR } from '../../lib/money'
import { useAccounts } from '../accounts/useAccounts'
import { BudgetAlerts } from '../budgets/BudgetAlerts'
import { useAuth } from '../auth/AuthProvider'

export function HomeScreen() {
  const { user, signOut } = useAuth()
  const { accounts, balances, loading, error } = useAccounts()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const displayName =
    typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name
      ? user.user_metadata.display_name
      : user?.email ?? ''

  const total = accounts.reduce((sum, account) => sum + (balances[account.id] ?? 0), 0)

  async function handleSignOut() {
    setSignOutError(null)
    setSigningOut(true)
    const result = await signOut()
    if (result.error) {
      setSignOutError(result.error)
      setSigningOut(false)
    }
  }

  return (
    <section aria-labelledby="titulo-inicio" className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Olá, {displayName}</p>
          <h1 id="titulo-inicio" className="mt-1 text-3xl font-semibold tracking-tight">
            Finora
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-1 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 disabled:opacity-60 dark:text-slate-300 dark:ring-slate-700"
        >
          {signingOut ? 'A sair…' : 'Terminar sessão'}
        </button>
      </header>

      {signOutError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {signOutError}
        </p>
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">Total em contas</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">
          {loading ? '…' : formatEUR(total)}
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {accounts.length === 0
              ? 'Ainda não tens contas registadas.'
              : accounts.length === 1
                ? '1 conta registada.'
                : `${accounts.length} contas registadas.`}
          </p>
        )}
      </div>
      <BudgetAlerts />
    </section>
  )
}
