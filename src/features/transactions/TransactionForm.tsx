import { useMemo, useState, type FormEvent } from 'react'
import { parseEurToCents } from '../../lib/money'
import type { Account, Category } from '../accounts/accountsService'
import {
  createTransaction,
  updateTransaction,
  type PaymentMethod,
  type Transaction,
  type TransactionInput,
  type TransactionKind,
} from './transactionsService'

interface TransactionFormProps {
  /** 'editar' atualiza o movimento existente; 'criar' cria um novo (usado também para duplicar). */
  mode: 'criar' | 'editar'
  /** Valores iniciais. Em 'editar' é o movimento a alterar; em 'criar' serve de modelo. */
  initial: Transaction | null
  accounts: Account[]
  categories: Category[]
  onDone: () => void
  onCancel: () => void
}

const KINDS: { value: TransactionKind; label: string }[] = [
  { value: 'despesa', label: 'Despesa' },
  { value: 'rendimento', label: 'Rendimento' },
  { value: 'transferencia', label: 'Transferência' },
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência bancária' },
  { value: 'mbway', label: 'MB WAY' },
  { value: 'outro', label: 'Outro' },
]

function toLocalDate(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}

function toLocalTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

export function TransactionForm({
  mode,
  initial,
  accounts,
  categories,
  onDone,
  onCancel,
}: TransactionFormProps) {
  const start = mode === 'editar' && initial ? new Date(initial.occurred_at) : new Date()

  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? 'despesa')
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount_cents) : '')
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [date, setDate] = useState(toLocalDate(start))
  const [time, setTime] = useState(toLocalTime(start))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(
    initial?.payment_method ?? '',
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isTransfer = kind === 'transferencia'
  const categoryKind = kind === 'rendimento' ? 'rendimento' : 'despesa'

  const availableCategories = useMemo(
    () => categories.filter((category) => category.kind === categoryKind),
    [categories, categoryKind],
  )

  function changeKind(next: TransactionKind) {
    setKind(next)
    setCategoryId('')
    if (next !== 'transferencia') {
      setToAccountId('')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const amountCents = parseEurToCents(amount)
    if (amountCents === null || amountCents <= 0) {
      setError('Indica um valor válido, maior que zero.')
      return
    }

    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setError('Indica uma descrição.')
      return
    }

    if (!accountId) {
      setError('Escolhe uma conta.')
      return
    }

    if (isTransfer && (!toAccountId || toAccountId === accountId)) {
      setError('Escolhe uma conta de destino diferente da conta de origem.')
      return
    }

    const occurred = new Date(`${date}T${time}`)
    if (Number.isNaN(occurred.getTime())) {
      setError('Data ou hora inválida.')
      return
    }

    const tagList = [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))]
    if (tagList.length > 10 || tagList.some((tag) => tag.length > 30)) {
      setError('Podes usar até 10 etiquetas, com no máximo 30 caracteres cada.')
      return
    }

    const input: TransactionInput = {
      kind,
      amount_cents: amountCents,
      account_id: accountId,
      to_account_id: isTransfer ? toAccountId : null,
      category_id: isTransfer || !categoryId ? null : categoryId,
      occurred_at: occurred.toISOString(),
      description: trimmedDescription,
      payment_method: paymentMethod === '' ? null : paymentMethod,
      notes: notes.trim() === '' ? null : notes.trim(),
      tags: tagList,
    }

    setSubmitting(true)
    try {
      if (mode === 'editar' && initial) {
        await updateTransaction(initial.id, input)
      } else {
        await createTransaction(input)
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível guardar. Tenta novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div role="radiogroup" aria-label="Tipo de movimento" className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
        {KINDS.map((option) => {
          const selected = kind === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => changeKind(option.value)}
              className={`rounded-xl px-2 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div>
        <label htmlFor="valor" className="text-sm font-medium">
          Valor (€)
        </label>
        <input
          id="valor"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={`${inputClass} text-2xl tabular-nums`}
        />
      </div>

      <div>
        <label htmlFor="descricao" className="text-sm font-medium">
          Descrição
        </label>
        <input
          id="descricao"
          type="text"
          maxLength={120}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="conta" className="text-sm font-medium">
          {isTransfer ? 'Conta de origem' : 'Conta'}
        </label>
        <select
          id="conta"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className={inputClass}
        >
          {accounts.length === 0 && <option value="">Sem contas</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {isTransfer && (
        <div>
          <label htmlFor="conta-destino" className="text-sm font-medium">
            Conta de destino
          </label>
          <select
            id="conta-destino"
            value={toAccountId}
            onChange={(event) => setToAccountId(event.target.value)}
            className={inputClass}
          >
            <option value="">Escolhe uma conta</option>
            {accounts
              .filter((account) => account.id !== accountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {!isTransfer && (
        <div>
          <label htmlFor="categoria" className="text-sm font-medium">
            Categoria
          </label>
          <select
            id="categoria"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClass}
          >
            <option value="">Sem categoria</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="data" className="text-sm font-medium">
            Data
          </label>
          <input
            id="data"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="hora" className="text-sm font-medium">
            Hora
          </label>
          <input
            id="hora"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="metodo" className="text-sm font-medium">
          Método de pagamento
        </label>
        <select
          id="metodo"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | '')}
          className={inputClass}
        >
          <option value="">Não indicado</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="etiquetas" className="text-sm font-medium">
          Etiquetas
        </label>
        <input
          id="etiquetas"
          type="text"
          placeholder="férias, casa"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Separadas por vírgulas.</p>
      </div>

      <div>
        <label htmlFor="notas" className="text-sm font-medium">
          Notas
        </label>
        <textarea
          id="notas"
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl px-4 py-3 text-base font-medium text-slate-600 ring-1 ring-slate-300 dark:text-slate-300 dark:ring-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
