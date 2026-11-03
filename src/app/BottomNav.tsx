import type { TabDefinition, TabId } from './navigation'

interface BottomNavProps {
  tabs: TabDefinition[]
  active: TabId
  onSelect: (id: TabId) => void
}

export function BottomNav({ tabs, active, onSelect }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === active

          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-brand-600 dark:text-brand-500'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
