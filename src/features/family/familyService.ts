import { supabase } from '../../lib/supabase'

export interface FamilyMember {
  id: string
  name: string
}

export interface Household {
  id: string
  name: string
  members: FamilyMember[]
}

const LOAD_ERROR = 'Não foi possível carregar o grupo familiar. Tenta novamente.'
const SAVE_ERROR = 'Não foi possível guardar. Tenta novamente.'

function errorMessage(error: { message: string } | null, fallback: string): string {
  // As funções da base de dados devolvem mensagens em português, que mostramos tal como estão.
  return error?.message && error.message.length > 0 ? error.message : fallback
}

/** Grupo familiar do utilizador (ou null) e os respetivos membros. */
export async function fetchHousehold(): Promise<Household | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, user_id, households(name)')

  if (error) {
    console.error(error)
    throw new Error(LOAD_ERROR)
  }

  const rows = (data ?? []) as unknown as {
    household_id: string
    user_id: string
    households: { name: string } | null
  }[]

  if (rows.length === 0) return null

  // Um utilizador pertence a um único grupo: o primeiro registo indica o grupo.
  const householdId = rows[0].household_id
  const memberRows = rows.filter((row) => row.household_id === householdId)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', memberRows.map((row) => row.user_id))

  if (profilesError) {
    console.error(profilesError)
    throw new Error(LOAD_ERROR)
  }

  const names = new Map<string, string>(
    ((profiles ?? []) as { id: string; display_name: string | null }[]).map(
      (profile): [string, string] => [profile.id, profile.display_name ?? 'Sem nome'],
    ),
  )

  return {
    id: householdId,
    name: memberRows[0].households?.name ?? 'Família',
    members: memberRows.map((row) => ({ id: row.user_id, name: names.get(row.user_id) ?? 'Sem nome' })),
  }
}

export async function createHousehold(name: string): Promise<void> {
  const { error } = await supabase.rpc('create_household', { p_name: name.trim() })

  if (error) {
    console.error(error)
    throw new Error(errorMessage(error, SAVE_ERROR))
  }
}

/** Convida uma pessoa pelo email. Devolve o nome da pessoa convidada. */
export async function inviteMember(householdId: string, email: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_household_member', {
    p_household: householdId,
    p_email: email.trim(),
  })

  if (error) {
    console.error(error)
    throw new Error(errorMessage(error, SAVE_ERROR))
  }

  return String(data ?? email)
}
