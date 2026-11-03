import { ArrowLeftRight, Home, MoreHorizontal, PieChart, Wallet, type LucideIcon } from 'lucide-react'

export type TabId = 'inicio' | 'movimentos' | 'contas' | 'orcamentos' | 'mais'

export interface TabDefinition {
  id: TabId
  label: string
  icon: LucideIcon
  /** Só fica visível quando o ecrã correspondente existir (regra: sem botões sem ação). */
  ready: boolean
}

export const TABS: TabDefinition[] = [
  { id: 'inicio', label: 'Início', icon: Home, ready: true },
  { id: 'movimentos', label: 'Movimentos', icon: ArrowLeftRight, ready: true },
  { id: 'contas', label: 'Contas', icon: Wallet, ready: true },
  { id: 'orcamentos', label: 'Orçamentos', icon: PieChart, ready: true },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal, ready: false },
]
