import { supabase } from '../../lib/supabase'
import type { AccountType } from './accountTypes'

export type CategoryKind = 'despesa' | 'rendimento'

export interface Account {
  id: string
  owner_id: string
  name: string
  account_type: AccountType
  opening_balance_cents: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  /** Nulo para categorias predefinidas, preenchido para categorias do utilizador. */
  owner_id: string | null
  name: string
  kind: CategoryKind
}

export interface AccountInput {
  name: string
  account_type: AccountType
  opening_balance_cents: number
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

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true })

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  return (data ?? []) as Category[]
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

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(DELETE_ERROR)
  }
}
