import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Copy, MailPlus, UserCheck, UserX, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Botao, CabecalhoPagina, Carregando, Confirmar, Entrada, Painel, Vazio } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useAlterarAtivo, useCancelarConvite, useConvidar, useConvites, usePerfis } from '@/hooks/dados'
import { mensagemErro } from '@/lib/utils'
import type { Perfil } from '@/types'

const dataCurta = (iso: string) => format(new Date(iso), "d 'de' MMM 'de' yyyy", { locale: ptBR })

export function Usuarios() {
  const { perfil: eu } = useAuth()
  const perfis = usePerfis(true)
  const convites = useConvites(true)
  const convidar = useConvidar()
  const cancelar = useCancelarConvite()
  const alterarAtivo = useAlterarAtivo()
  const [email, setEmail] = useState('')
  const [desativando, setDesativando] = useState<Perfil | null>(null)

  const linkCadastro = `${window.location.origin}${window.location.pathname}#/cadastro`
  const pendentes = (convites.data ?? []).filter((c) => !c.usado_em)

  const enviarConvite = async (e: FormEvent) => {
    e.preventDefault()
    const limpo = email.trim().toLowerCase()
    if ((perfis.data ?? []).some((p) => p.email === limpo)) return toast.error('Esse e-mail já tem conta.')
    try {
      await convidar.mutateAsync(limpo)
      setEmail('')
      toast.success(`Convite criado para ${limpo}. Agora envie o link de cadastro para a pessoa.`)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkCadastro)
      toast.success('Link de cadastro copiado.')
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente: ' + linkCadastro)
    }
  }

  const mudarAtivo = async (p: Perfil, ativo: boolean) => {
    try {
      await alterarAtivo.mutateAsync({ userId: p.user_id, ativo })
      toast.success(ativo ? `${p.email} foi reativado.` : `${p.email} foi desativado.`)
      setDesativando(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Usuários" subtitulo="Só quem você convidar consegue criar conta." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Painel className="p-5 sm:p-6">
          <h2 className="font-semibold text-tinta">Convidar alguém</h2>
          <p className="mt-1 text-sm text-tinta-suave">Cadastre o e-mail e envie o link de cadastro. A pessoa cria a própria senha e já entra.</p>
          <form onSubmit={enviarConvite} className="mt-4 flex gap-2">
            <Entrada type="email" required placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail do convidado" />
            <Botao type="submit" carregando={convidar.isPending} className="shrink-0">
              <MailPlus className="size-4" aria-hidden /> Convidar
            </Botao>
          </form>
          <div className="mt-5 rounded-xl bg-superficie-2 p-3">
            <p className="text-sm text-tinta-suave">Link de cadastro</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-sm text-tinta">{linkCadastro}</code>
              <Botao variante="secundario" tamanho="sm" onClick={copiarLink}>
                <Copy className="size-4" aria-hidden /> Copiar
              </Botao>
            </div>
          </div>

          <h3 className="mt-7 text-sm font-semibold text-tinta">Convites pendentes</h3>
          {convites.isLoading ? (
            <Carregando />
          ) : pendentes.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">Nenhum convite esperando cadastro.</p>
          ) : (
            <ul className="mt-2 divide-y divide-linha/70">
              {pendentes.map((c) => (
                <li key={c.email} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-tinta">{c.email}</p>
                    <p className="text-sm text-tinta-suave">Convidado em {dataCurta(c.criado_em)}</p>
                  </div>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() =>
                      cancelar.mutate(c.email, {
                        onSuccess: () => toast.success('Convite cancelado.'),
                        onError: (e) => toast.error(mensagemErro(e)),
                      })
                    }
                  >
                    <X className="size-4" aria-hidden /> Cancelar
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel className="p-5 sm:p-6">
          <h2 className="font-semibold text-tinta">Contas</h2>
          {perfis.isLoading ? (
            <Carregando />
          ) : !perfis.data?.length ? (
            <Vazio titulo="Nenhuma conta ainda" />
          ) : (
            <ul className="mt-3 divide-y divide-linha/70">
              {perfis.data.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between gap-3 py-3">
                  <Avatar nome={p.nome} email={p.email} foto={p.foto_url} tamanho={36} />
                  <div className="min-w-0 flex-1">
                    {p.nome && <p className="truncate text-[15px] font-medium text-tinta">{p.nome}</p>}
                    <p className={p.nome ? 'truncate text-sm text-tinta-suave' : 'truncate text-[15px] text-tinta'}>
                      {p.email}
                      {p.user_id === eu?.user_id && <span className="text-tinta-suave"> (você)</span>}
                    </p>
                    <p className="text-sm text-tinta-suave">
                      {p.papel === 'master' ? 'Administra a plataforma' : 'Estudante'} · desde {dataCurta(p.criado_em)}
                      {!p.ativo && <span className="font-semibold text-ruim"> · desativado</span>}
                    </p>
                  </div>
                  {p.papel !== 'master' &&
                    (p.ativo ? (
                      <Botao variante="secundario" tamanho="sm" onClick={() => setDesativando(p)}>
                        <UserX className="size-4" aria-hidden /> Desativar
                      </Botao>
                    ) : (
                      <Botao variante="secundario" tamanho="sm" onClick={() => void mudarAtivo(p, true)} carregando={alterarAtivo.isPending}>
                        <UserCheck className="size-4" aria-hidden /> Reativar
                      </Botao>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <Confirmar
        aberto={!!desativando}
        aoMudar={(a) => !a && setDesativando(null)}
        titulo="Desativar conta?"
        texto={`${desativando?.email ?? ''} perde o acesso na hora. Os dados dessa pessoa continuam guardados e voltam se você reativar a conta.`}
        textoBotao="Desativar"
        carregando={alterarAtivo.isPending}
        aoConfirmar={() => desativando && void mudarAtivo(desativando, false)}
      />
    </>
  )
}
