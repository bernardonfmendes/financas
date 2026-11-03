/**
 * Valores monetários são sempre guardados em cêntimos (inteiros).
 * Nunca usar floats para dinheiro.
 */
export type Cents = number

/** Formata cêntimos em euros, no formato português de Portugal (ex.: "12,50 €"). */
export function formatEUR(cents: Cents): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

/**
 * Converte texto introduzido pelo utilizador em cêntimos.
 * Aceita "12,50", "12.50", "12" e "1.250,00". Devolve null se o formato for inválido.
 */
export function parseEurToCents(input: string): Cents | null {
  let normalized = input.trim().replace(/\s/g, '')

  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null
  }

  return Math.round(Number(normalized) * 100)
}
