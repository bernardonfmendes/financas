import { supabase } from '../../lib/supabase'

export type TransactionKind = 'despesa' | 'rendimento' | 'transferencia'

export type PaymentMethod = 'dinheiro' | 'cartao' | 'transferencia' | 'mbway' | 'outro'

export interface Transaction {
  id: string
  owner_id: string
  kind: TransactionKind
  amount_cents: number
  account_id: string
  to_account_id: string | null
  category_id: string | null
  occurred_at: string
  description: string
  payment_method: PaymentMethod | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface TransactionInput {
  kind: TransactionKind
  amount_cents: number
  account_id: string
  to_account_id: string | null
  category_id: string | null
  occurred_at: string
  description: string
  payment_method: PaymentMethod | null
  notes: string | null
  tags: string[]
}

const LOAD_ERROR = 'Não foi possível carregar os movimentos. Tenta novamente.'
const SAVE_ERROR = 'Não foi possível guardar. Tenta novamente.'
const DELETE_ERROR = 'Não foi possível apagar. Tenta novamente.'
const INVALID_ERROR = 'Os dados do movimento não são válidos. Confirma a conta, a categoria e o tipo.'

/** Mensagem para erros de escrita: violações de RLS (42501) ou de validação (23514) são dados inválidos. */
function saveErrorMessage(code: string | undefined): string {
  if (code === '42501' || code === '23514') {
    return INVALID_ERROR
  }
  return SAVE_ERROR
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  return (data ?? []) as Transaction[]
}

export async function createTransaction(input: TransactionInput): Promise<void> {
  const { error } = await supabase.from('transactions').insert(input)

  if (error) {
    console.error(error)
    throw new Error(saveErrorMessage(error.code))
  }
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const { error } = await supabase.from('transactions').update(input).eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(saveErrorMessage(error.code))
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(DELETE_ERROR)
  }
}
