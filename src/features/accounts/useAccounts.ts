import { useCallback, useEffect, useState } from 'react'
import { fetchAccountBalances, fetchAccounts, type Account } from './accountsService'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [accountList, balanceMap] = await Promise.all([fetchAccounts(), fetchAccountBalances()])
      setAccounts(accountList)
      setBalances(balanceMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { accounts, balances, loading, error, reload: load }
}
