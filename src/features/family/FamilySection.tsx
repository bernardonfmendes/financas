import { useState, type FormEvent } from 'react'
import { createHousehold, inviteMember, type Household } from './familyService'

interface FamilySectionProps {
  household: Household | null
  onChanged: () => void
}

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
}

export function FamilySection({ household, onChanged }: FamilySectionProps) {
  const [groupName, setGroupName] = useState('Família')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!groupName.trim()) {
      setError('Indica um nome para o grupo.')
      return
    }

    setBusy(true)
    try {
      await createHousehold(groupName)
      onChanged()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!household) return
    if (!email.trim()) {
      setError('Indica o email da pessoa.')
      return
    }

    setBusy(true)
    try {
      const name = await inviteMember(household.id, email)
      setEmail('')
      setNotice(`${name} foi adicionado ao grupo.`)
      onChanged()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="titulo-familia" className="space-y-4">
      <h2 id="titulo-familia" className="text-xl font-semibold tracking-tight">Família</h2>

      {!household && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" noValidate>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cria um grupo para partilhar contas, como a conta conjunta. Depois podes convidar a outra pessoa pelo email.
          </p>
          <div>
            <label htmlFor="grupo-nome" className="text-sm font-medium">Nome do grupo</label>
            <input id="grupo-nome" type="text" maxLength={60} value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
            {busy ? 'A criar…' : 'Criar grupo'}
          </button>
        </form>
      )}

      {household && (
        <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Grupo</p>
            <p className="font-medium">{household.name}</p>
          </div>

          <ul className="space-y-2">
            {household.members.map((member) => (
              <li key={member.id} className="text-sm">{member.name}</li>
            ))}
          </ul>

          <form onSubmit={handleInvite} className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800" noValidate>
            <div>
              <label htmlFor="convite-email" className="text-sm font-medium">Convidar pelo email</label>
              <input id="convite-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A pessoa tem de ter conta na app.</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 disabled:opacity-60 dark:text-slate-200 dark:ring-slate-700">
              {busy ? 'A convidar…' : 'Convidar'}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
