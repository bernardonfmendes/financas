import { useMemo, useState, type FormEvent } from 'react'
import { formatEUR, parseEurToCents } from '../../lib/money'
import type { Account, Category } from '../accounts/accountsService'
import { createRule, deleteRule, FREQUENCIES, setRuleActive, type RecurringRule, type RuleKind } from './recurringService'

interface RecurringSectionProps {
  accounts: Account[]
  categories: Category[]
  rules: RecurringRule[]
  onChanged: () => void
}

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
}

function frequencyLabel(value: RecurringRule['frequency']): string {
  return FREQUENCIES.find((option) => option.value === value)?.label ?? value
}

function shortDate(day: string): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return new Date(year, month - 1, dayOfMonth).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
  })
}

export function RecurringSection({ accounts, categories, rules, onChanged }: RecurringSectionProps) {
  const today = new Date().toLocaleDateString('sv-SE')

  const [kind, setKind] = useState<RuleKind>('despesa')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [frequency, setFrequency] = useState<RecurringRule['frequency']>('mensal')
  const [startDate, setStartDate] = useState(today)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const availableCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  )

  const categoryNames = useMemo(
    () => new Map<string, string>(categories.map((category): [string, string] => [category.id, category.name])),
    [categories],
  )

  const accountNames = useMemo(
    () => new Map<string, string>(accounts.map((account): [string, string] => [account.id, account.name])),
    [accounts],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const cents = parseEurToCents(amount)
    if (cents === null || cents <= 0) {
      setError('Indica um valor válido, maior que zero.')
      return
    }

    const trimmed = description.trim()
    if (!trimmed) {
      setError('Indica uma descrição.')
      return
    }

    if (!accountId) {
      setError('Escolhe uma conta.')
      return
    }

    if (!startDate) {
      setError('Indica a data da primeira ocorrência.')
      return
    }

    setSaving(true)
    try {
      await createRule({
        kind,
        amount_cents: cents,
        account_id: accountId,
        category_id: categoryId || null,
        description: trimmed,
        frequency,
        next_due: startDate,
      })
      setAmount('')
      setDescription('')
      setCategoryId('')
      setStartDate(today)
      setFormOpen(false)
      onChanged()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(rule: RecurringRule) {
    setError(null)
    try {
      await setRuleActive(rule.id, !rule.active)
      onChanged()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function handleDelete(rule: RecurringRule) {
    if (!window.confirm('Apagar esta recorrência? As previstas por pagar também são apagadas.')) {
      return
    }
    setError(null)
    try {
      await deleteRule(rule.id)
      onChanged()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  return (
    <section aria-labelledby="titulo-recorrentes" className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 id="titulo-recorrentes" className="text-xl font-semibold tracking-tight">
          Recorrentes
        </h2>
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          disabled={accounts.length === 0}
          className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {formOpen ? 'Fechar' : 'Nova'}
        </button>
      </header>

      {formOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" noValidate>
          <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
            {(['despesa', 'rendimento'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={kind === option}
                onClick={() => {
                  setKind(option)
                  setCategoryId('')
                }}
                className={`rounded-xl px-2 py-2 text-sm font-medium ${
                  kind === option ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {option === 'despesa' ? 'Despesa' : 'Rendimento'}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="rec-valor" className="text-sm font-medium">Valor (€)</label>
            <input id="rec-valor" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label htmlFor="rec-descricao" className="text-sm font-medium">Descrição</label>
            <input id="rec-descricao" type="text" maxLength={120} placeholder="Ex.: Renda, Netflix" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label htmlFor="rec-conta" className="text-sm font-medium">Conta</label>
            <select id="rec-conta" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-categoria" className="text-sm font-medium">Categoria</label>
            <select id="rec-categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Sem categoria</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rec-frequencia" className="text-sm font-medium">Frequência</label>
              <select id="rec-frequencia" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringRule['frequency'])} className={inputClass}>
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rec-inicio" className="text-sm font-medium">Primeira data</label>
              <input id="rec-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={saving} className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
            {saving ? 'A guardar…' : 'Guardar recorrência'}
          </button>
        </form>
      )}

      {!formOpen && error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {rules.length === 0 && !formOpen && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não tens recorrências.</p>
      )}

      <ul className="space-y-3">
        {rules.map((rule) => (
          <li key={rule.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{rule.description}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {frequencyLabel(rule.frequency)} · {accountNames.get(rule.account_id) ?? 'Conta removida'}
                  {rule.category_id ? ` · ${categoryNames.get(rule.category_id) ?? ''}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Próxima: {shortDate(rule.next_due)}{rule.active ? '' : ' · pausada'}
                </p>
              </div>
              <p className={`shrink-0 tabular-nums font-medium ${rule.kind === 'rendimento' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {rule.kind === 'rendimento' ? '+ ' : '− '}
                {formatEUR(rule.amount_cents)}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void handleToggle(rule)} className="flex-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 dark:text-slate-200 dark:ring-slate-700">
                {rule.active ? 'Pausar' : 'Ativar'}
              </button>
              <button type="button" onClick={() => void handleDelete(rule)} className="flex-1 rounded-xl px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-300 dark:text-red-400 dark:ring-red-900">
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
