import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export interface AuthResult {
  error: string | null
  /** Verdadeiro quando a conta foi criada mas precisa de confirmação por email. */
  needsConfirmation?: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Traduz erros do Supabase Auth para português de Portugal. */
function translateAuthError(error: AuthError): string {
  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Email ou palavra-passe incorretos.'
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Já existe uma conta com este email.'
  }
  if (message.includes('at least') && message.includes('characters')) {
    return 'A palavra-passe deve ter pelo menos 6 caracteres.'
  }
  if (message.includes('email not confirmed')) {
    return 'Confirma primeiro o teu email para entrar.'
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Demasiadas tentativas. Aguarda alguns minutos e tenta de novo.'
  }

  return 'Ocorreu um erro. Tenta novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? translateAuthError(error) : null }
      },

      signUp: async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        })

        if (error) {
          return { error: translateAuthError(error) }
        }

        return { error: null, needsConfirmation: data.session === null }
      },

      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        return { error: error ? translateAuthError(error) : null }
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth tem de ser usado dentro de AuthProvider.')
  }

  return context
}
