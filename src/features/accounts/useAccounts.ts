import { useCallback, useEffect, useState } from 'react'
import { fetchAccounts, type Account } from './accountsService'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setAccounts(await fetchAccounts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { accounts, loading, error, reload: load }
}
