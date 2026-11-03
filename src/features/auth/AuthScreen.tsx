import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'

type Mode = 'entrar' | 'criar'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('entrar')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isCreating = mode === 'criar'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      if (isCreating) {
        const result = await signUp(email.trim(), password, displayName.trim())

        if (result.error) {
          setError(result.error)
        } else if (result.needsConfirmation) {
          setInfo('Enviámos um email de confirmação. Confirma a conta e volta a entrar.')
          setMode('entrar')
        }
      } else {
        const result = await signIn(email.trim(), password)

        if (result.error) {
          setError(result.error)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

  return (
    <section aria-labelledby="titulo-autenticacao" className="space-y-8">
      <header>
        <h1 id="titulo-autenticacao" className="text-3xl font-semibold tracking-tight">
          Finanças
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {isCreating ? 'Cria a tua conta para começar.' : 'Entra na tua conta.'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {isCreating && (
          <div>
            <label htmlFor="nome" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="nome"
              type="text"
              required
              maxLength={80}
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="palavra-passe" className="text-sm font-medium">
            Palavra-passe
          </label>
          <input
            id="palavra-passe"
            type="password"
            required
            minLength={6}
            autoComplete={isCreating ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {info && (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {submitting ? 'A processar…' : isCreating ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {isCreating ? 'Já tens conta?' : 'Ainda não tens conta?'}{' '}
        <button
          type="button"
          onClick={() => {
            setError(null)
            setInfo(null)
            setMode(isCreating ? 'entrar' : 'criar')
          }}
          className="font-semibold text-brand-600 dark:text-brand-500"
        >
          {isCreating ? 'Entrar' : 'Criar conta'}
        </button>
      </p>
    </section>
  )
}
