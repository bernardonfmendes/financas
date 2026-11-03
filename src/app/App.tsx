import { useState } from 'react'
import { BottomNav } from './BottomNav'
import { TABS, type TabId } from './navigation'
import { HomeScreen } from '../features/dashboard/HomeScreen'

export function App() {
  const [active, setActive] = useState<TabId>('inicio')
  const readyTabs = TABS.filter((tab) => tab.ready)

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-md px-5 pb-28 pt-12">
        {active === 'inicio' && <HomeScreen />}
      </main>
      <BottomNav tabs={readyTabs} active={active} onSelect={setActive} />
    </div>
  )
}
