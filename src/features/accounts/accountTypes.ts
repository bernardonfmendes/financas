export type AccountType =
  | 'dinheiro'
  | 'banco'
  | 'cartao_debito'
  | 'cartao_credito'
  | 'poupanca'
  | 'conjunta'

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'banco', label: 'Banco' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'conjunta', label: 'Conta conjunta' },
]

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((item) => item.value === type)?.label ?? type
}
