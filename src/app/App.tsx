import { useEffect, useState } from 'react'
import { BottomNav } from './BottomNav'
import { TABS, type TabId } from './navigation'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { AuthScreen } from '../features/auth/AuthScreen'
import { AccountsScreen } from '../features/accounts/AccountsScreen'
import { HomeScreen } from '../features/dashboard/HomeScreen'
import { TransactionsScreen } from '../features/transactions/TransactionsScreen'
import { BudgetsScreen } from '../features/budgets/BudgetsScreen'
import { RelatoriosScreen } from '../features/reports/RelatoriosScreen'

/** Lê ?novo=1 (usado pelo atalho do iPhone) uma única vez, ao abrir a app. */
function wantsQuickEntry(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('novo') === '1'
  } catch {
    return false
  }
}

function AppContent() {
  const { user, loading } = useAuth()
  const [quickEntryPending, setQuickEntryPending] = useState(wantsQuickEntry)
  const [active, setActive] = useState<TabId>(quickEntryPending ? 'movimentos' : 'inicio')

  useEffect(() => {
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // Sem histórico disponível: a app continua a funcionar normalmente.
    }
  }, [])
  const readyTabs = TABS.filter((tab) => tab.ready)

  if (loading) {
    return <div className="min-h-dvh bg-slate-50 dark:bg-slate-950" aria-busy="true" />
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main className="mx-auto max-w-md px-5 pb-10 pt-12">
          <AuthScreen />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-md px-5 pb-28 pt-12">
        {active === 'inicio' && <HomeScreen />}
        {active === 'movimentos' && (
          <TransactionsScreen
            startInQuickEntry={quickEntryPending}
            onQuickEntryStarted={() => setQuickEntryPending(false)}
          />
        )}
        {active === 'contas' && <AccountsScreen />}
        {active === 'orcamentos' && <BudgetsScreen />}
        {active === 'relatorios' && <RelatoriosScreen />}
      </main>
      <BottomNav tabs={readyTabs} active={active} onSelect={setActive} />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
