import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  type Category,
  type CategoryKind,
} from './accountsService'

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

const KIND_LABELS: Record<CategoryKind, string> = {
  despesa: 'Despesa',
  rendimento: 'Rendimento',
}

export function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('despesa')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCategories(await fetchCategories())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const predefined = categories.filter((category) => category.owner_id === null)
  const custom = categories.filter((category) => category.owner_id !== null)

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Indica um nome para a categoria.')
      return
    }

    setBusy(true)
    try {
      await createCategory(trimmed, kind)
      setName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Apagar a categoria "${category.name}"?`)) return

    setError(null)
    setBusy(true)
    try {
      await deleteCategory(category.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="titulo-categorias" className="space-y-5">
      <h2 id="titulo-categorias" className="text-xl font-semibold tracking-tight">
        Categorias
      </h2>

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>}

      {!loading && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Predefinidas</p>
            <ul className="space-y-2">
              {predefined.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                >
                  <span>{category.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {KIND_LABELS[category.kind]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">As tuas</p>
            {custom.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ainda não criaste categorias.
              </p>
            )}
            <ul className="space-y-2">
              {custom.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                >
                  <span>
                    {category.name}
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                      {KIND_LABELS[category.kind]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(category)}
                    disabled={busy}
                    className="text-sm font-medium text-red-600 disabled:opacity-60 dark:text-red-400"
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <form onSubmit={handleAdd} className="space-y-4" noValidate>
        <div>
          <label htmlFor="categoria-nome" className="text-sm font-medium">
            Nova categoria
          </label>
          <input
            id="categoria-nome"
            type="text"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="categoria-tipo" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="categoria-tipo"
            value={kind}
            onChange={(event) => setKind(event.target.value as CategoryKind)}
            className={inputClass}
          >
            <option value="despesa">Despesa</option>
            <option value="rendimento">Rendimento</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'A guardar…' : 'Adicionar categoria'}
        </button>
      </form>
    </section>
  )
}
