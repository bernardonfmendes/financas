import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEUR } from '../../lib/money'
import { fetchAccounts, fetchCategories, type Account, type Category } from '../accounts/accountsService'
import { fetchAllTransactions, type Transaction } from '../transactions/transactionsService'
import { buildCsv, buildPdf, shareOrDownload, type ReportData } from './reportExport'
import {
  expensesByCategory,
  monthlySeries,
  paidInPeriod,
  periodRange,
  REPORT_PERIODS,
  summarize,
  topExpenses,
  yearlySeries,
  type ReportPeriod,
} from './reportsService'

const CHART_COLORS = ['#0f766e', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#84cc16', '#0ea5e9', '#a855f7', '#64748b', '#f97316']

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocorreu um erro. Tenta novamente.'
}

function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export function RelatoriosScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)
  const [period, setPeriod] = useState<ReportPeriod>('mes')
  const [categoryId, setCategoryId] = useState<string>('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [transactionList, categoryList, accountList] = await Promise.all([
          fetchAllTransactions(),
          fetchCategories(),
          fetchAccounts(),
        ])
        if (!active) return
        setTransactions(transactionList)
        setCategories(categoryList)
        setAccounts(accountList)
      } catch (err) {
        if (active) setError(messageOf(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const categoryNames = useMemo(
    () => new Map<string, string>(categories.map((category): [string, string] => [category.id, category.name])),
    [categories],
  )

  const accountNames = useMemo(
    () => new Map<string, string>(accounts.map((account): [string, string] => [account.id, account.name])),
    [accounts],
  )

  const range = useMemo(() => periodRange(period, transactions), [period, transactions])
  const selectedCategory = categoryId || null

  const list = useMemo(
    () => paidInPeriod(transactions, range, selectedCategory),
    [transactions, range, selectedCategory],
  )

  const summary = useMemo(() => summarize(list, range), [list, range])
  const categoryTotals = useMemo(() => expensesByCategory(list, categoryNames), [list, categoryNames])
  const top = useMemo(() => topExpenses(list), [list])
  const months = useMemo(() => monthlySeries(transactions, selectedCategory), [transactions, selectedCategory])
  const years = useMemo(() => yearlySeries(transactions, selectedCategory), [transactions, selectedCategory])

  const categoryLabel = selectedCategory ? (categoryNames.get(selectedCategory) ?? 'Categoria') : 'Todas'

  async function handleExport(kind: 'pdf' | 'csv') {
    setError(null)
    setExporting(kind)
    try {
      if (kind === 'csv') {
        const blob = buildCsv(list, accountNames, categoryNames)
        await shareOrDownload(blob, `finora-${period}.csv`, 'text/csv', 'Movimentos')
      } else {
        const data: ReportData = {
          periodLabel: range.label,
          categoryLabel,
          summary,
          categories: categoryTotals,
          top: top.map((transaction) => ({
            date: dayText(transaction.occurred_at),
            description: transaction.description,
            category: transaction.category_id ? (categoryNames.get(transaction.category_id) ?? '') : '',
            amount: transaction.amount_cents,
          })),
          months,
          years,
        }
        const blob = buildPdf(data)
        await shareOrDownload(blob, `relatorio-finora-${period}.pdf`, 'application/pdf', 'Relatório financeiro')
      }
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setExporting(null)
    }
  }

  return (
    <section aria-labelledby="titulo-relatorios" className="space-y-8">
      <header>
        <h1 id="titulo-relatorios" className="text-3xl font-semibold tracking-tight">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{range.label}</p>
      </header>

      <div className="space-y-3">
        <div role="radiogroup" aria-label="Período" className="flex gap-2 overflow-x-auto">
          {REPORT_PERIODS.map((option) => {
            const selected = period === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPeriod(option.value)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 ring-1 ring-slate-200 dark:text-slate-400 dark:ring-slate-800'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <div>
          <label htmlFor="rel-categoria" className="text-sm font-medium">Categoria</label>
          <select
            id="rel-categoria"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A carregar…</p>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Rendimentos" value={formatEUR(summary.income)} tone="positive" />
            <Stat label="Despesas" value={formatEUR(summary.expenses)} />
            <Stat label="Poupança" value={formatEUR(summary.savings)} tone={summary.savings >= 0 ? 'positive' : 'negative'} />
            <Stat label="Média diária" value={formatEUR(summary.avgDaily)} />
            <Stat label="Média mensal" value={formatEUR(summary.avgMonthly)} />
          </div>

          <section aria-labelledby="titulo-categorias-grafico" className="space-y-3">
            <h2 id="titulo-categorias-grafico" className="text-xl font-semibold tracking-tight">Despesas por categoria</h2>
            {categoryTotals.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem despesas neste período.</p>
            ) : (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryTotals} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={90}>
                        {categoryTotals.map((entry, index) => (
                          <Cell key={entry.id ?? 'none'} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatEUR(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2">
                  {categoryTotals.map((entry, index) => (
                    <li key={entry.id ?? 'none'} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{entry.percent}% · {formatEUR(entry.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="titulo-evolucao" className="space-y-3">
            <h2 id="titulo-evolucao" className="text-xl font-semibold tracking-tight">Evolução mensal</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${Math.round(value / 100)}`} width={48} />
                  <Tooltip formatter={(value) => formatEUR(Number(value))} />
                  <Legend />
                  <Bar dataKey="income" name="Rendimentos" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Despesas" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {years.length > 1 && (
            <section aria-labelledby="titulo-anos" className="space-y-3">
              <h2 id="titulo-anos" className="text-xl font-semibold tracking-tight">Comparação anual</h2>
              <ul className="space-y-2">
                {years.map((year) => (
                  <li key={year.year} className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <span className="font-medium">{year.year}</span>
                    <span className="tabular-nums">
                      +{formatEUR(year.income)} · −{formatEUR(year.expenses)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="titulo-maiores" className="space-y-3">
            <h2 id="titulo-maiores" className="text-xl font-semibold tracking-tight">Maiores gastos</h2>
            {top.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem despesas neste período.</p>
            ) : (
              <ul className="space-y-2">
                {top.map((transaction) => (
                  <li key={transaction.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{transaction.description}</p>
                      <p className="text-slate-500 dark:text-slate-400">{dayText(transaction.occurred_at)}</p>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium">{formatEUR(transaction.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-exportar" className="space-y-3">
            <h2 id="titulo-exportar" className="text-xl font-semibold tracking-tight">Exportar e partilhar</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => void handleExport('pdf')}
                className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {exporting === 'pdf' ? 'A preparar…' : 'PDF'}
              </button>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => void handleExport('csv')}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 disabled:opacity-60 dark:text-slate-200 dark:ring-slate-700"
              >
                {exporting === 'csv' ? 'A preparar…' : 'CSV'}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No iPhone abre o menu de partilha, para enviares o ficheiro por mensagem ou email.
            </p>
          </section>
        </>
      )}
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const color =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'negative' ? 'text-red-600 dark:text-red-400' : ''
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
