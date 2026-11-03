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
