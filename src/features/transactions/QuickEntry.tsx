import { useMemo, useState } from 'react'
import { formatEUR, parseEurToCents } from '../../lib/money'
import type { Account, Category } from '../accounts/accountsService'
import { createTransaction, type TransactionKind } from './transactionsService'

interface QuickEntryProps {
  accounts: Account[]
  categories: Category[]
  onSaved: () => void
  onAdvanced: () => void
  onCancel: () => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'] as const

export function QuickEntry({ accounts, categories, onSaved, onAdvanced, onCancel }: QuickEntryProps) {
  const [amountText, setAmountText] = useState('')
  const [kind, setKind] = useState<'despesa' | 'rendimento'>('despesa')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const amountCents = useMemo(() => {
    if (amountText === '') return null
    return parseEurToCents(amountText)
  }, [amountText])

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  )

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null
  const canSave = amountCents !== null && amountCents > 0 && accountId !== '' && !saving

  function pressKey(key: (typeof KEYS)[number]) {
    setError(null)

    if (key === '⌫') {
      setAmountText((current) => current.slice(0, -1))
      return
    }

    if (key === ',') {
      if (amountText.includes(',')) return
      setAmountText((current) => (current === '' ? '0,' : `${current},`))
      return
    }

    // Limita a duas casas decimais.
    const commaIndex = amountText.indexOf(',')
    if (commaIndex !== -1 && amountText.length - commaIndex > 2) return

    // Limita o valor a seis dígitos antes da vírgula.
    if (commaIndex === -1 && amountText.length >= 6) return

    setAmountText((current) => `${current}${key}`)
  }

  async function handleSave() {
    if (amountCents === null || amountCents <= 0 || !accountId) return

    setError(null)
    setSaving(true)

    try {
      await createTransaction({
        kind: kind satisfies TransactionKind,
        amount_cents: amountCents,
        account_id: accountId,
        to_account_id: null,
        category_id: categoryId || null,
        occurred_at: new Date().toISOString(),
        description: selectedCategory?.name ?? (kind === 'rendimento' ? 'Rendimento' : 'Despesa'),
        payment_method: null,
        notes: null,
        tags: [],
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível guardar. Tenta novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <section className="space-y-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Antes de registar movimentos, cria uma conta no separador Contas.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-2xl px-4 py-3 text-base font-medium text-slate-600 ring-1 ring-slate-300 dark:text-slate-300 dark:ring-slate-700"
        >
          Voltar
        </button>
      </section>
    )
  }

  return (
    <section aria-label="Registo rápido" className="flex min-h-[calc(100dvh-10rem)] flex-col gap-5">
      <div className="flex items-center justify-between">
        <div role="radiogroup" aria-label="Tipo de movimento" className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-900">
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
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                kind === option
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {option === 'despesa' ? 'Despesa' : 'Rendimento'}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Cancelar
        </button>
      </div>

      <div className="text-center">
        <p
          className="text-5xl font-semibold tabular-nums tracking-tight"
          aria-live="polite"
        >
          {amountCents !== null && amountCents > 0 ? formatEUR(amountCents) : '0,00 €'}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <div className="-mx-5 overflow-x-auto px-5">
        <div className="flex gap-2 pb-1">
          {visibleCategories.map((category) => {
            const selected = category.id === categoryId
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategoryId(selected ? '' : category.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors ${
                  selected
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'bg-white text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800'
                }`}
              >
                <span className="mr-1">{category.icon}</span>
                {category.name}
              </button>
            )
          })}
        </div>
      </div>

      {accounts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {accounts.map((account) => {
            const selected = account.id === accountId
            return (
              <button
                key={account.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAccountId(account.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                  selected
                    ? 'bg-slate-900 text-white ring-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100'
                    : 'text-slate-500 ring-slate-200 dark:text-slate-400 dark:ring-slate-800'
                }`}
              >
                {account.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-auto grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pressKey(key)}
            aria-label={key === '⌫' ? 'Apagar' : key === ',' ? 'Vírgula' : key}
            className="rounded-2xl bg-white py-4 text-2xl font-medium ring-1 ring-slate-200 active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-800 dark:active:bg-slate-800"
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-2xl bg-brand-600 px-4 py-4 text-lg font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {saving ? 'A guardar…' : 'Guardar'}
      </button>

      <button
        type="button"
        onClick={onAdvanced}
        className="text-center text-sm font-medium text-brand-600 dark:text-brand-500"
      >
        Mais opções (data, notas, transferência)
      </button>
    </section>
  )
}
