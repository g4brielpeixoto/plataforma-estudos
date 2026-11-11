import { CircleCheck, Lock, LogOut } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Marca } from '@/components/Layout'
import { Botao, Campo, Entrada, EntradaSenha } from '@/components/ui'
import { VersiculoCard } from '@/components/VersiculoCard'
import { useAuth } from '@/contexts/AuthContext'

function Moldura({ titulo, subtitulo, children, rodape }: { titulo: string; subtitulo?: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Marca />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-medium tracking-[-0.01em] text-tinta">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-tinta-suave">{subtitulo}</p>}
          <div className="mt-8">{children}</div>
          {rodape && <div className="mt-6 text-sm text-tinta-suave">{rodape}</div>}
        </div>
      </div>
      <div className="hidden items-center bg-perola p-10 lg:flex xl:p-16">
        <VersiculoCard className="w-full" />
      </div>
    </div>
  )
}

function Aviso({ tipo, children }: { tipo: 'erro' | 'ok'; children: ReactNode }) {
  return (
    <p role={tipo === 'erro' ? 'alert' : 'status'} className={tipo === 'erro' ? 'rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim' : 'rounded-xl bg-bom-fundo px-3 py-2.5 text-sm text-bom'}>
      {children}
    </p>
  )
}

export function Login() {
  const { sessao, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (sessao) return <Navigate to="/" replace />

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura
      titulo="Entrar"
      subtitulo="Continue de onde parou."
      rodape={
        <>
          Recebeu um convite? <Link to="/cadastro" className="font-semibold text-primaria-forte underline-offset-2 hover:underline">Criar conta</Link>
        </>
      }
    >
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="E-mail" htmlFor="email">
          <Entrada id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo rotulo="Senha" htmlFor="senha">
          <EntradaSenha id="senha" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-sm font-medium text-primaria-forte underline-offset-2 hover:underline">
            Esqueci a senha
          </Link>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" className="w-full" carregando={enviando}>
          Entrar
        </Botao>
      </form>
    </Moldura>
  )
}

export function Cadastro() {
  const { sessao, cadastrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (sessao) return <Navigate to="/" replace />

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não são iguais.')
    setEnviando(true)
    try {
      await cadastrar(email, senha)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura
      titulo="Criar conta"
      subtitulo="Use o e-mail que recebeu o convite."
      rodape={
        <>
          Já tem conta? <Link to="/login" className="font-semibold text-primaria-forte underline-offset-2 hover:underline">Entrar</Link>
        </>
      }
    >
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="E-mail" htmlFor="email">
          <Entrada id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo rotulo="Senha" htmlFor="senha" dica="Pelo menos 6 caracteres.">
          <EntradaSenha id="senha" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Campo rotulo="Repita a senha" htmlFor="confirmacao">
          <EntradaSenha id="confirmacao" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" className="w-full" carregando={enviando}>
          Criar conta
        </Botao>
      </form>
    </Moldura>
  )
}

export function EsqueciSenha() {
  const { enviarRecuperacao } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await enviarRecuperacao(email)
      setEnviado(true)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link para você criar uma senha nova."
      rodape={
        <Link to="/login" className="font-semibold text-primaria-forte underline-offset-2 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {enviado ? (
        <div className="flex gap-3 rounded-2xl bg-bom-fundo p-4 text-bom">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-[15px]">
            Se <strong>{email}</strong> tiver conta, o link chega em instantes. Abra-o neste mesmo aparelho e navegador.
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo rotulo="E-mail" htmlFor="email">
            <Entrada id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao type="submit" className="w-full" carregando={enviando}>
            Enviar link
          </Botao>
        </form>
      )}
    </Moldura>
  )
}

export function RedefinirSenha() {
  const { sessao, redefinirSenha } = useAuth()
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!sessao)
    return (
      <Moldura titulo="Link expirado" subtitulo="Este link de recuperação não é mais válido ou foi aberto em outro navegador.">
        <Botao className="w-full" onClick={() => navegar('/esqueci-senha')}>
          Pedir um link novo
        </Botao>
      </Moldura>
    )

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não são iguais.')
    setEnviando(true)
    try {
      await redefinirSenha(senha)
      navegar('/', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura titulo="Nova senha" subtitulo={`Defina a nova senha de ${sessao.user.email}.`}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Nova senha" htmlFor="senha" dica="Pelo menos 6 caracteres.">
          <EntradaSenha id="senha" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Campo rotulo="Repita a nova senha" htmlFor="confirmacao">
          <EntradaSenha id="confirmacao" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" className="w-full" carregando={enviando}>
          Salvar nova senha
        </Botao>
      </form>
    </Moldura>
  )
}

export function ContaDesativada({ semPerfil = false }: { semPerfil?: boolean }) {
  const { sair } = useAuth()
  return (
    <Moldura
      titulo={semPerfil ? 'Não foi possível abrir sua conta' : 'Conta desativada'}
      subtitulo={
        semPerfil
          ? 'Não encontramos o cadastro desta conta ou a conexão falhou. Recarregue a página; se continuar, fale com quem administra a plataforma.'
          : 'Seu acesso foi desativado por quem administra a plataforma. Seus dados continuam guardados.'
      }
    >
      {!semPerfil && (
        <div className="flex items-center gap-3 rounded-2xl bg-superficie-2 p-4 text-tinta-suave">
          <Lock className="size-5 shrink-0" aria-hidden />
          <p className="text-[15px]">Peça para reativarem seu acesso e entre de novo.</p>
        </div>
      )}
      <Botao variante="secundario" className="mt-4 w-full" onClick={() => void sair()}>
        <LogOut className="size-4" aria-hidden /> Sair
      </Botao>
    </Moldura>
  )
}
