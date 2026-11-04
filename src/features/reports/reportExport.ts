import { jsPDF } from 'jspdf'
import { formatEUR } from '../../lib/money'
import type { Transaction } from '../transactions/transactionsService'
import type { CategoryTotal, MonthPoint, Summary, YearPoint } from './reportsService'

export interface ReportData {
  periodLabel: string
  categoryLabel: string
  summary: Summary
  categories: CategoryTotal[]
  top: { date: string; description: string; category: string; amount: number }[]
  months: MonthPoint[]
  years: YearPoint[]
}

function centsText(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** CSV com ; como separador (abre bem no Excel em português). */
export function buildCsv(
  list: Transaction[],
  accountNames: Map<string, string>,
  categoryNames: Map<string, string>,
): Blob {
  const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor (€)']
  const lines = [header.join(';')]

  for (const transaction of [...list].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    const date = new Date(transaction.occurred_at).toLocaleDateString('pt-PT')
    const category = transaction.category_id ? (categoryNames.get(transaction.category_id) ?? '') : ''
    const sign = transaction.kind === 'rendimento' ? '' : '-'
    lines.push(
      [
        csvCell(date),
        csvCell(transaction.kind),
        csvCell(transaction.description),
        csvCell(category),
        csvCell(accountNames.get(transaction.account_id) ?? ''),
        `${sign}${centsText(transaction.amount_cents)}`,
      ].join(';'),
    )
  }

  // BOM para o Excel reconhecer os acentos.
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/** PDF com resumo, categorias, maiores gastos e evolução. */
export function buildPdf(data: ReportData): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  const pageHeight = 297 - margin
  let y = margin

  function ensureSpace(lines: number) {
    if (y + lines * 6 > pageHeight) {
      doc.addPage()
      y = margin
    }
  }

  function heading(text: string) {
    ensureSpace(3)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(text, margin, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
  }

  function row(columns: [string, number, 'left' | 'right'][]) {
    ensureSpace(1)
    doc.setFontSize(10)
    for (const [text, x, align] of columns) {
      doc.text(text, align === 'right' ? x : margin + x, y, { align })
    }
    y += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Relatório financeiro', margin, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Período: ${data.periodLabel}`, margin, y)
  y += 6
  doc.text(`Categoria: ${data.categoryLabel}`, margin, y)
  y += 6
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')}`, margin, y)
  y += 4

  heading('Resumo')
  row([['Rendimentos', 0, 'left'], [formatEUR(data.summary.income), 180, 'right']])
  row([['Despesas', 0, 'left'], [formatEUR(data.summary.expenses), 180, 'right']])
  row([['Poupança', 0, 'left'], [formatEUR(data.summary.savings), 180, 'right']])
  row([['Média diária de despesa', 0, 'left'], [formatEUR(data.summary.avgDaily), 180, 'right']])
  row([['Média mensal de despesa', 0, 'left'], [formatEUR(data.summary.avgMonthly), 180, 'right']])

  heading('Despesas por categoria')
  if (data.categories.length === 0) {
    row([['Sem despesas neste período.', 0, 'left']])
  }
  for (const category of data.categories) {
    row([
      [category.name, 0, 'left'],
      [`${category.percent}%`, 140, 'right'],
      [formatEUR(category.amount), 180, 'right'],
    ])
  }

  heading('Maiores gastos')
  if (data.top.length === 0) {
    row([['Sem despesas neste período.', 0, 'left']])
  }
  for (const item of data.top) {
    row([
      [`${item.date}  ${item.description}`, 0, 'left'],
      [formatEUR(item.amount), 180, 'right'],
    ])
  }

  heading('Evolução mensal (últimos 12 meses)')
  row([
    ['Mês', 0, 'left'],
    ['Rendimentos', 110, 'right'],
    ['Despesas', 180, 'right'],
  ])
  for (const month of data.months) {
    row([
      [month.label, 0, 'left'],
      [formatEUR(month.income), 110, 'right'],
      [formatEUR(month.expenses), 180, 'right'],
    ])
  }

  if (data.years.length > 1) {
    heading('Comparação anual')
    row([
      ['Ano', 0, 'left'],
      ['Rendimentos', 110, 'right'],
      ['Despesas', 180, 'right'],
    ])
    for (const year of data.years) {
      row([
        [String(year.year), 0, 'left'],
        [formatEUR(year.income), 110, 'right'],
        [formatEUR(year.expenses), 180, 'right'],
      ])
    }
  }

  return doc.output('blob')
}

/** Partilha o ficheiro pelo menu do iPhone; se não for possível, descarrega-o. */
export async function shareOrDownload(blob: Blob, filename: string, type: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type })
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }

  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (err) {
      // Cancelar a partilha não é erro.
      if (err instanceof Error && err.name === 'AbortError') return
      throw err
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
