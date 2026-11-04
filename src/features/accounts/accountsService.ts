import { supabase } from '../../lib/supabase'
import type { AccountType } from './accountTypes'

export type CategoryKind = 'despesa' | 'rendimento'

export interface Account {
  id: string
  owner_id: string
  name: string
  account_type: AccountType
  opening_balance_cents: number
  /** Preenchido quando a conta é partilhada com o grupo familiar. */
  household_id: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  /** Nulo para categorias predefinidas, preenchido para categorias do utilizador. */
  owner_id: string | null
  name: string
  kind: CategoryKind
  /** Emoji escolhido pelo utilizador (ou o predefinido). */
  icon: string
  /** Ordem escolhida pelo utilizador (menor aparece primeiro). */
  sort_order: number
}

const DEFAULT_ICONS: Record<string, string> = {
  'Alimentação': '🍽️',
  'Compras': '🛍️',
  'Contas e serviços': '🧾',
  'Educação': '🎓',
  'Habitação': '🏠',
  'Lazer': '🎉',
  'Outros': '📦',
  'Outros rendimentos': '💰',
  'Salário': '💼',
  'Saúde': '💊',
  'Transportes': '🚗',
}

export function defaultIcon(name: string): string {
  return DEFAULT_ICONS[name] ?? '🏷️'
}

export interface AccountInput {
  name: string
  account_type: AccountType
  opening_balance_cents: number
  household_id: string | null
}

const LOAD_ERROR = 'Não foi possível carregar os dados. Tenta novamente.'
const SAVE_ERROR = 'Não foi possível guardar. Tenta novamente.'
const DELETE_ERROR = 'Não foi possível apagar. Tenta novamente.'

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  return (data ?? []) as Account[]
}

/** Saldo atual de cada conta (saldo inicial + movimentos), indexado pelo id da conta. */
export async function fetchAccountBalances(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('account_balances').select('account_id, balance_cents')

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  const balances: Record<string, number> = {}

  for (const row of (data ?? []) as { account_id: string; balance_cents: number }[]) {
    balances[row.account_id] = Number(row.balance_cents)
  }

  return balances
}

export async function createAccount(input: AccountInput): Promise<void> {
  const { error } = await supabase.from('accounts').insert(input)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function updateAccount(id: string, input: AccountInput): Promise<void> {
  const { error } = await supabase.from('accounts').update(input).eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id)

  if (error) {
    console.error(error)

    // 23503 = violação de chave estrangeira: a conta ainda tem movimentos associados.
    if (error.code === '23503') {
      throw new Error('Esta conta tem movimentos. Apaga primeiro os movimentos dela.')
    }

    throw new Error(DELETE_ERROR)
  }
}

interface CategoryPreference {
  category_id: string
  icon: string | null
  sort_order: number | null
}

export async function fetchCategories(): Promise<Category[]> {
  const [categoriesResult, preferencesResult] = await Promise.all([
    supabase.from('categories').select('*').order('name', { ascending: true }),
    supabase.from('category_preferences').select('category_id, icon, sort_order'),
  ])

  if (categoriesResult.error || preferencesResult.error) {
    console.error(categoriesResult.error ?? preferencesResult.error)
    throw new Error(LOAD_ERROR)
  }

  const preferences = new Map<string, CategoryPreference>(
    ((preferencesResult.data ?? []) as CategoryPreference[]).map((pref): [string, CategoryPreference] => [pref.category_id, pref]),
  )

  const categories = ((categoriesResult.data ?? []) as { id: string; owner_id: string | null; name: string; kind: CategoryKind }[])
    .map((category, index) => {
      const pref = preferences.get(category.id)
      return {
        ...category,
        icon: pref?.icon ?? defaultIcon(category.name),
        // Sem ordem guardada, as categorias ficam por ordem alfabética depois das que têm ordem.
        sort_order: pref?.sort_order ?? 1000 + index,
      }
    })

  return categories.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-PT'))
}

export async function saveCategoryIcon(categoryId: string, icon: string): Promise<void> {
  const { error } = await supabase
    .from('category_preferences')
    .upsert({ category_id: categoryId, icon }, { onConflict: 'owner_id,category_id' })

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

/** Guarda a nova ordem de todas as categorias de uma vez (índice = posição). */
export async function saveCategoryOrder(orderedIds: string[]): Promise<void> {
  const rows = orderedIds.map((id, index) => ({ category_id: id, sort_order: index }))
  const { error } = await supabase
    .from('category_preferences')
    .upsert(rows, { onConflict: 'owner_id,category_id' })

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function createCategory(name: string, kind: CategoryKind): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    throw new Error(SAVE_ERROR)
  }

  const { error } = await supabase
    .from('categories')
    .insert({ name, kind, owner_id: userData.user.id })

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ name }).eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(DELETE_ERROR)
  }
}
