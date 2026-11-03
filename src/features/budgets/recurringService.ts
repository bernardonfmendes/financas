import { supabase } from '../../lib/supabase'

export type Frequency = 'diaria' | 'semanal' | 'mensal' | 'trimestral' | 'anual'
export type RuleKind = 'despesa' | 'rendimento'

export interface RecurringRule {
  id: string
  owner_id: string
  kind: RuleKind
  amount_cents: number
  account_id: string
  category_id: string | null
  description: string
  frequency: Frequency
  /** Data (AAAA-MM-DD) da próxima ocorrência ainda não criada. */
  next_due: string
  active: boolean
}

export interface RecurringInput {
  kind: RuleKind
  amount_cents: number
  account_id: string
  category_id: string | null
  description: string
  frequency: Frequency
  next_due: string
}

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
]

const LOAD_ERROR = 'Não foi possível carregar as recorrências. Tenta novamente.'
const SAVE_ERROR = 'Não foi possível guardar. Tenta novamente.'

/** Quantos dias à frente criar as previstas. */
const HORIZON_DAYS = 30

/** Data local no formato AAAA-MM-DD. */
export function toIsoDay(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}

/** Próxima data a partir de uma data AAAA-MM-DD, segundo a frequência. */
export function addFrequency(day: string, frequency: Frequency): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  const date = new Date(year, month - 1, dayOfMonth)

  if (frequency === 'diaria') date.setDate(date.getDate() + 1)
  if (frequency === 'semanal') date.setDate(date.getDate() + 7)
  if (frequency === 'mensal') date.setMonth(date.getMonth() + 1)
  if (frequency === 'trimestral') date.setMonth(date.getMonth() + 3)
  if (frequency === 'anual') date.setFullYear(date.getFullYear() + 1)

  return toIsoDay(date)
}

export async function fetchRules(): Promise<RecurringRule[]> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .order('next_due', { ascending: true })

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  return (data ?? []) as RecurringRule[]
}

export async function createRule(input: RecurringInput): Promise<void> {
  const { error } = await supabase.from('recurring_rules').insert(input)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

export async function setRuleActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('recurring_rules').update({ active }).eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

/** Apaga a regra e as previstas que ainda não foram pagas. Os movimentos já pagos ficam. */
export async function deleteRule(id: string): Promise<void> {
  const { error: plannedError } = await supabase
    .from('transactions')
    .delete()
    .eq('recurring_rule_id', id)
    .eq('status', 'prevista')

  if (plannedError) {
    console.error(plannedError)
    throw new Error(SAVE_ERROR)
  }

  const { error } = await supabase.from('recurring_rules').delete().eq('id', id)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}

/**
 * Cria as previstas das regras ativas até HORIZON_DAYS à frente.
 * O índice único (regra, data prevista) impede duplicados: se já existir, a ocorrência é ignorada.
 */
export async function generatePlannedOccurrences(rules: RecurringRule[]): Promise<void> {
  const limit = new Date()
  limit.setDate(limit.getDate() + HORIZON_DAYS)
  const limitDay = toIsoDay(limit)

  for (const rule of rules) {
    if (!rule.active) continue

    let due = rule.next_due

    while (due <= limitDay) {
      const { error } = await supabase.from('transactions').insert({
        kind: rule.kind,
        amount_cents: rule.amount_cents,
        account_id: rule.account_id,
        to_account_id: null,
        category_id: rule.category_id,
        occurred_at: new Date(`${due}T12:00:00`).toISOString(),
        description: rule.description,
        payment_method: null,
        notes: null,
        tags: [],
        status: 'prevista',
        recurring_rule_id: rule.id,
        due_date: due,
      })

      // 23505 = já existe uma prevista para esta regra e data: não é erro.
      if (error && error.code !== '23505') {
        console.error(error)
        throw new Error(SAVE_ERROR)
      }

      due = addFrequency(due, rule.frequency)
    }

    if (due !== rule.next_due) {
      const { error } = await supabase.from('recurring_rules').update({ next_due: due }).eq('id', rule.id)

      if (error) {
        console.error(error)
        throw new Error(SAVE_ERROR)
      }
    }
  }
}

/** Marca uma prevista como paga. Mantém a data prevista como data do movimento. */
export async function markPlannedAsPaid(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'paga' })
    .eq('id', transactionId)

  if (error) {
    console.error(error)
    throw new Error(SAVE_ERROR)
  }
}
