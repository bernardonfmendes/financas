import { formatEUR } from '../../lib/money'

export function HomeScreen() {
  const totalBalance = 0

  return (
    <section aria-labelledby="titulo-inicio" className="space-y-8">
      <header>
        <p className="text-sm text-slate-500 dark:text-slate-400">Visão geral</p>
        <h1 id="titulo-inicio" className="mt-1 text-3xl font-semibold tracking-tight">
          Finanças
        </h1>
      </header>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">Saldo total</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">{formatEUR(totalBalance)}</p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Ainda não tens contas registadas.
        </p>
      </div>
    </section>
  )
}
