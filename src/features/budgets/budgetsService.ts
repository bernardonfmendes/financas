import { supabase } from '../../lib/supabase'

export interface Budget {
  id: string
  owner_id: string
  category_id: string
  amount_cents: number
  alert_percent: number
}

const LOAD_ERROR = 'Não foi possível carregar os orçamentos. Tenta novamente.'
const SAVE_ERROR = 'Não foi possível guardar o orçamento. Tenta novamente.'
const DELETE_ERROR = 'Não foi possível remover o orçamento. Tenta novamente.'

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*')

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  return (data ?? []) as Budget[]
}

/** Cria ou atualiza o orçamento mensal de uma categoria (uma por categoria). */
export async function saveBudget(categoryId: string, amountCents: number, alertPercent: number): Promise<void> {
  const { error } = await supabase.from('budgets').upsert(
    { category_id: categoryId, amount_cents: amountCents, alert_percent: alertPercent },
    { onConflict: 'owner_id,category_id' },
  )

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(DELETE_ERROR)
  }
}
