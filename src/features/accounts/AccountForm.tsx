import { useState, type FormEvent } from 'react'
import { centsToInput, parseEurToCents } from '../../lib/money'
import { ACCOUNT_TYPES, type AccountType } from './accountTypes'
import { createAccount, deleteAccount, updateAccount, type Account } from './accountsService'

interface AccountFormProps {
  initial: Account | null
  /** Grupo familiar do utilizador, ou null se ainda não tiver grupo. */
  householdId: string | null
  onDone: () => void
  onCancel: () => void
}

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

export function AccountForm({ initial, householdId, onDone, onCancel }: AccountFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [accountType, setAccountType] = useState<AccountType>(initial?.account_type ?? 'banco')
  const [balance, setBalance] = useState(
    initial ? centsToInput(initial.opening_balance_cents) : '0,00',
  )
  const [shared, setShared] = useState(initial?.household_id != null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Indica um nome para a conta.')
      return
    }

    const cents = parseEurToCents(balance)
    if (cents === null) {
      setError('Indica um saldo válido, por exemplo 150,00.')
      return
    }

    const input = {
      name: trimmedName,
      account_type: accountType,
      opening_balance_cents: cents,
      household_id: shared && householdId ? householdId : null,
    }

    setBusy(true)
    try {
      if (initial) {
        await updateAccount(initial.id, input)
      } else {
        await createAccount(input)
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!initial) return
    if (!window.confirm(`Apagar a conta "${initial.name}"? Esta ação não pode ser desfeita.`)) return

    setError(null)
    setBusy(true)
    try {
      await deleteAccount(initial.id)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="conta-nome" className="text-sm font-medium">
          Nome
        </label>
        <input
          id="conta-nome"
          type="text"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="conta-tipo" className="text-sm font-medium">
          Tipo
        </label>
        <select
          id="conta-tipo"
          value={accountType}
          onChange={(event) => setAccountType(event.target.value as AccountType)}
          className={inputClass}
        >
          {ACCOUNT_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="conta-saldo" className="text-sm font-medium">
          Saldo inicial (€)
        </label>
        <input
          id="conta-saldo"
          type="text"
          inputMode="decimal"
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
          className={inputClass}
        />
      </div>

      {householdId && (
        <label className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} className="h-5 w-5 accent-brand-600" />
          <span className="text-sm">
            <span className="block font-medium">Partilhar com a família</span>
            <span className="text-slate-500 dark:text-slate-400">Todos os membros do grupo passam a ver esta conta e os seus movimentos.</span>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-2xl px-4 py-3 text-base font-medium text-slate-600 ring-1 ring-slate-300 disabled:opacity-60 dark:text-slate-300 dark:ring-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'A guardar…' : 'Guardar'}
        </button>
      </div>

      {initial && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="w-full rounded-2xl px-4 py-3 text-base font-medium text-red-600 disabled:opacity-60 dark:text-red-400"
        >
          Apagar conta
        </button>
      )}
    </form>
  )
}
