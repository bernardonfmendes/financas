import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { SwipeableRow } from '../transactions/SwipeableRow'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  renameCategory,
  saveCategoryIcon,
  saveCategoryOrder,
  type Category,
  type CategoryKind,
} from './accountsService'

const ICON_OPTIONS = [
  '🍽️', '🛍️', '🧾', '🎓', '🏠', '🎉', '📦', '💰',
  '💼', '💊', '🚗', '⛽', '☕', '🍺', '🍕', '🛒',
  '🎬', '🎮', '✈️', '🏋️', '🐶', '👶', '💡', '📱',
  '🎁', '👕', '💈', '🏥', '🚌', '🌳', '🔧', '📚',
  '💳', '🏦', '❤️', '🏷️', '🚬', '🧹', '🧴', '🐾',
]

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900'

const KIND_LABELS: Record<CategoryKind, string> = {
  despesa: 'Despesa',
  rendimento: 'Rendimento',
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
}

export function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('despesa')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCategories(await fetchCategories())
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startEditing(category: Category) {
    setError(null)
    setEditing(category)
    setEditName(category.name)
    setEditIcon(category.icon)
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return

    const trimmed = editName.trim()
    const isCustom = editing.owner_id !== null

    if (isCustom && !trimmed) {
      setError('Indica um nome para a categoria.')
      return
    }

    setError(null)
    setBusy(true)
    try {
      if (editIcon !== editing.icon) {
        await saveCategoryIcon(editing.id, editIcon)
      }
      if (isCustom && trimmed !== editing.name) {
        await renameCategory(editing.id, trimmed)
      }
      setEditing(null)
      await load()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= categories.length) return

    const ids = categories.map((category) => category.id)
    const current = ids[index]
    ids[index] = ids[target]
    ids[target] = current

    setError(null)
    setBusy(true)
    try {
      await saveCategoryOrder(ids)
      await load()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

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
      setError(messageOf(err))
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
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="titulo-categorias" className="space-y-5">
      <div>
        <h2 id="titulo-categorias" className="text-xl font-semibold tracking-tight">
          Categorias
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Toca numa categoria para mudar o ícone. As setas mudam a ordem. Nas tuas, desliza para a direita para editar ou para a esquerda para apagar.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>}

      {editing && (
        <form onSubmit={handleSaveEdit} className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" noValidate>
          <p className="text-sm font-medium">Editar {KIND_LABELS[editing.kind].toLowerCase()}</p>

          {editing.owner_id !== null && (
            <div>
              <label htmlFor="categoria-editar" className="text-sm font-medium">Nome</label>
              <input id="categoria-editar" type="text" maxLength={60} value={editName} onChange={(event) => setEditName(event.target.value)} className={inputClass} />
            </div>
          )}

          <div>
            <p className="text-sm font-medium">Ícone</p>
            <div className="mt-2 grid grid-cols-8 gap-2">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={editIcon === icon}
                  onClick={() => setEditIcon(icon)}
                  className={`flex h-10 items-center justify-center rounded-xl text-xl ${
                    editIcon === icon ? 'bg-brand-600/15 ring-2 ring-brand-600' : 'ring-1 ring-slate-200 dark:ring-slate-800'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300 dark:text-slate-300 dark:ring-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {!loading && (
        <ul className="space-y-2">
          {categories.map((category, index) => {
            const row = (
              <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <button type="button" onClick={() => startEditing(category)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="text-xl" aria-hidden="true">{category.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{category.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {KIND_LABELS[category.kind]}
                      {category.owner_id === null ? ' · predefinida' : ''}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 flex-col">
                  <button type="button" aria-label="Subir" disabled={busy || index === 0} onClick={() => void handleMove(index, -1)} className="px-2 text-sm text-slate-500 disabled:opacity-30">▲</button>
                  <button type="button" aria-label="Descer" disabled={busy || index === categories.length - 1} onClick={() => void handleMove(index, 1)} className="px-2 text-sm text-slate-500 disabled:opacity-30">▼</button>
                </div>
              </div>
            )

            return (
              <li key={category.id}>
                {category.owner_id !== null ? (
                  <SwipeableRow onSwipeLeft={() => void handleDelete(category)} onSwipeRight={() => startEditing(category)}>
                    {row}
                  </SwipeableRow>
                ) : (
                  row
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && !editing && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={handleAdd} className="space-y-4" noValidate>
        <div>
          <label htmlFor="categoria-nome" className="text-sm font-medium">Nova categoria</label>
          <input id="categoria-nome" type="text" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="categoria-tipo" className="text-sm font-medium">Tipo</label>
          <select id="categoria-tipo" value={kind} onChange={(event) => setKind(event.target.value as CategoryKind)} className={inputClass}>
            <option value="despesa">Despesa</option>
            <option value="rendimento">Rendimento</option>
          </select>
        </div>

        <button type="submit" disabled={busy} className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
          {busy ? 'A guardar…' : 'Adicionar categoria'}
        </button>
      </form>
    </section>
  )
}
