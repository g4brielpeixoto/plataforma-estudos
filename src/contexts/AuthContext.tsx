import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Perfil } from '@/types'

interface AuthValor {
  sessao: Session | null
  /** undefined = ainda carregando; null = não encontrado */
  perfil: Perfil | null | undefined
  carregando: boolean
  /** true depois que o usuário abre o link de "esqueci a senha" */
  recuperandoSenha: boolean
  entrar: (email: string, senha: string) => Promise<void>
  cadastrar: (email: string, senha: string) => Promise<void>
  enviarRecuperacao: (email: string) => Promise<void>
  redefinirSenha: (senha: string) => Promise<void>
  sair: () => Promise<void>
  /** busca o perfil de novo (depois de editar nome ou foto) */
  recarregarPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthValor | null>(null)

/** Traduz as mensagens do Supabase Auth para algo útil a quem está usando */
export function traduzirErroAuth(e: unknown): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : ''
  const codigo = e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/database error saving new user/i.test(msg) || /EMAIL_NAO_CONVIDADO/.test(msg))
    return 'Este e-mail não foi convidado. Peça um convite a quem administra a plataforma.'
  if (/already registered|already been registered/i.test(msg) || codigo === 'user_already_exists')
    return 'Este e-mail já tem conta. Entre com sua senha ou use "Esqueci a senha".'
  if (/password should be at least/i.test(msg) || codigo === 'weak_password') return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/email not confirmed/i.test(msg)) return 'Este e-mail ainda não foi confirmado.'
  if (/signups? (are|is) (not allowed|disabled)/i.test(msg) || codigo === 'signup_disabled' || codigo === 'email_provider_disabled')
    return 'O cadastro está desligado no momento. Avise quem administra a plataforma.'
  if (/logins? (are|is) disabled/i.test(msg)) return 'O login por e-mail está desligado no momento. Avise quem administra a plataforma.'
  if (/rate limit|too many/i.test(msg) || codigo === 'over_email_send_rate_limit')
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (/not authorized|sending .*email/i.test(msg))
    return 'Não foi possível enviar o e-mail agora. O envio de e-mails da plataforma ainda não está configurado.'
  if (/same.*password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (/failed to fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.'
  return msg || 'Algo deu errado. Tente de novo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)
  const qc = useQueryClient()

  const usuarioAtual = useRef<string | null>(null)

  const carregarPerfil = useCallback(async (s: Session | null, silencioso = false) => {
    usuarioAtual.current = s?.user.id ?? null
    if (!s) {
      setPerfil(null)
      return
    }
    if (!silencioso) setPerfil(undefined)
    const { data, error } = await supabase.from('perfis').select('*').eq('user_id', s.user.id).maybeSingle()
    if (usuarioAtual.current !== s.user.id) return
    if (error && silencioso) return
    setPerfil(error ? null : ((data as Perfil | null) ?? null))
  }, [])

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      setSessao(data.session)
      await carregarPerfil(data.session)
      if (ativo) setCarregando(false)
      limparCodigoDaUrl()
    })
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setRecuperandoSenha(true)
        window.location.hash = '#/redefinir-senha'
      }
      if (evento === 'SIGNED_OUT') qc.clear()
      setSessao(s)
      // só recarrega o perfil quando muda o usuário (não a cada renovação de token)
      const novoId = s?.user.id ?? null
      if (novoId !== usuarioAtual.current) {
        usuarioAtual.current = novoId
        if (s) setPerfil(undefined)
        // fora do callback, para não travar o cliente do Supabase
        setTimeout(() => {
          void carregarPerfil(s)
        }, 0)
      }
    })
    return () => {
      ativo = false
      assinatura.subscription.unsubscribe()
    }
  }, [carregarPerfil, qc])

  const valor: AuthValor = {
    sessao,
    perfil,
    carregando,
    recuperandoSenha,
    async entrar(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) throw new Error(traduzirErroAuth(error))
    },
    async cadastrar(email, senha) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: senha })
      if (error) throw new Error(traduzirErroAuth(error))
      // Supabase devolve um usuário sem identidades quando o e-mail já existe
      if (data.user && data.user.identities && data.user.identities.length === 0)
        throw new Error('Este e-mail já tem conta. Entre com sua senha ou use "Esqueci a senha".')
      if (!data.session) {
        // confirmação por e-mail ainda ligada no painel do Supabase
        throw new Error('Conta criada, mas o login automático está desligado. Tente entrar com seu e-mail e senha.')
      }
    },
    async enviarRecuperacao(email) {
      const destino = `${window.location.origin}${window.location.pathname}`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: destino })
      if (error) throw new Error(traduzirErroAuth(error))
    },
    async redefinirSenha(senha) {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw new Error(traduzirErroAuth(error))
      setRecuperandoSenha(false)
    },
    async sair() {
      await supabase.auth.signOut()
    },
    async recarregarPerfil() {
      await carregarPerfil(sessao, true)
    },
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

/** Remove o ?code= deixado pelo link de recuperação, mantendo a rota em hash */
function limparCodigoDaUrl() {
  const url = new URL(window.location.href)
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    url.search = ''
    window.history.replaceState(null, '', url.toString())
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
