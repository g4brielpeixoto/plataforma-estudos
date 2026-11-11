import * as Menu from '@radix-ui/react-dropdown-menu'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CircleCheck, EllipsisVertical, Pause, Pencil, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ConteudoCartao, useLadosDoCartao } from '@/components/flashcards/ConteudoCartao'
import { NotaFlashDialog } from '@/components/flashcards/NotaFlashDialog'
import { Botao, Carregando } from '@/components/ui'
import { chaves, useAtualizarCartoesFlash, useDesfazerFlash, useResponderFlash } from '@/hooks/dados'
import { filtroEscopo, useDadosFlash } from '@/hooks/useFlash'
import { criarAgendador, previa, responder } from '@/lib/flashcards/agenda'
import { contagem, disponiveis, proximoAprendizado, proximoCartao, type FeitosHoje, type Fila } from '@/lib/flashcards/fila'
import { cn, formatarDuracao, mensagemErro } from '@/lib/utils'
import type { FlashCartao, FlashNota, RespostaFlash } from '@/types'

const BOTOES: { resposta: RespostaFlash; rotulo: string; classe: string }[] = [
  { resposta: 1, rotulo: 'Errei', classe: 'text-ruim' },
  { resposta: 2, rotulo: 'Difícil', classe: 'text-tinta-suave' },
  { resposta: 3, rotulo: 'Bom', classe: 'text-bom' },
  { resposta: 4, rotulo: 'Fácil', classe: 'text-revisao' },
]

/** Tempo máximo contado por cartão (como no Anki) */
const MAX_POR_CARTAO = 60_000

interface Passo {
  anterior: FlashCartao
  fila: Fila
  revisaoId: string
  resposta: RespostaFlash
  duracao: number
}

/** Sessão de revisão, em tela cheia: frente → mostrar resposta → Errei/Difícil/Bom/Fácil */
export function RevisaoFlash() {
  const { escopo = 'todos' } = useParams()
  const [busca] = useSearchParams()
  const topicoId = busca.get('topico')
  const disciplinaId = escopo === 'todos' ? null : escopo
  const navegar = useNavigate()
  const qc = useQueryClient()
  const dados = useDadosFlash()
  const responderFlash = useResponderFlash()
  const desfazerFlash = useDesfazerFlash()
  const atualizar = useAtualizarCartoesFlash()

  // a sessão trabalha com uma cópia dos cartões do escopo, atualizada a cada resposta
  const [mapa, setMapa] = useState<Map<string, FlashCartao> | null>(null)
  const [feitos, setFeitos] = useState<FeitosHoje>(new Map())
  const [respondidos, setRespondidos] = useState(0)
  const [passos, setPassos] = useState<Passo[]>([])
  const [atual, setAtual] = useState<{ cartao: FlashCartao; fila: Fila } | null>(null)
  const [revelado, setRevelado] = useState(false)
  const [mostradoEm, setMostradoEm] = useState(() => Date.now())
  const [relogio, setRelogio] = useState(() => Date.now())
  const [editando, setEditando] = useState<FlashNota | null>(null)
  // as gravações vão em fila, na ordem (responder e depois desfazer, por exemplo)
  const gravacoes = useRef<Promise<unknown>>(Promise.resolve())

  const agendador = useMemo(() => criarAgendador(dados.limites.retencao), [dados.limites.retencao])
  const filtro = useMemo(() => filtroEscopo(disciplinaId, topicoId), [disciplinaId, topicoId])

  const calcular = useCallback(
    (m: Map<string, FlashCartao>, f: FeitosHoje, agora = new Date()) =>
      disponiveis(
        [...m.values()].filter((c) => !c.suspenso),
        dados.disciplinaDoCartao,
        f,
        dados.limites,
        agora,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados.notaPorId, dados.limites.novos_por_dia, dados.limites.revisoes_por_dia],
  )

  // começa a sessão quando os dados chegam
  useEffect(() => {
    if (dados.carregando || mapa) return
    const m = new Map(dados.cartoes.filter((c) => !c.suspenso && dados.notaPorId.has(c.nota_id) && filtro(dados.notaPorId.get(c.nota_id)!)).map((c) => [c.id, c]))
    const f = new Map([...dados.feitos].map(([k, v]) => [k, { ...v }]))
    setMapa(m)
    setFeitos(f)
    setAtual(proximoCartao(calcular(m, f), 0))
    setMostradoEm(Date.now())
  }, [dados.carregando, dados.cartoes, dados.notaPorId, dados.feitos, filtro, mapa, calcular])

  // sem cartão na tela, confere de tempos em tempos se um cartão em aprendizado já venceu
  useEffect(() => {
    if (atual || !mapa) return
    const id = window.setInterval(() => setRelogio(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [atual, mapa])
  useEffect(() => {
    if (atual || !mapa) return
    const proximo = proximoCartao(calcular(mapa, feitos), respondidos)
    if (proximo) {
      setAtual(proximo)
      setRevelado(false)
      setMostradoEm(Date.now())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relogio])

  // ao sair, recarrega os dados para as outras telas
  useEffect(
    () => () => {
      void gravacoes.current.finally(() => {
        void qc.invalidateQueries({ queryKey: chaves.flashCartoes })
        void qc.invalidateQueries({ queryKey: chaves.flashRevisoes })
      })
    },
    [qc],
  )

  const disp = useMemo(() => (mapa ? calcular(mapa, feitos) : null), [mapa, feitos, calcular, relogio]) // eslint-disable-line react-hooks/exhaustive-deps
  const cont = disp ? contagem(disp) : { novos: 0, aprendendo: 0, revisar: 0 }
  const nota = atual ? dados.notaPorId.get(atual.cartao.nota_id) : undefined
  const lados = useLadosDoCartao(nota, atual?.cartao)
  const intervalos = useMemo(() => (atual && revelado ? previa(agendador, atual.cartao, new Date()) : null), [atual, revelado, agendador])

  const enfileirar = (tarefa: () => Promise<unknown>) => {
    gravacoes.current = gravacoes.current.then(tarefa).catch((e) => toast.error(`Não foi possível salvar a revisão: ${mensagemErro(e)}. Confira a conexão.`))
  }

  const responderCom = (resposta: RespostaFlash) => {
    if (!atual || !revelado || !mapa) return
    const agora = new Date()
    const anterior = atual.cartao
    const novo = responder(agendador, anterior, resposta, agora)
    const duracao = Math.min(MAX_POR_CARTAO, Math.max(0, agora.getTime() - mostradoEm))
    const revisao = {
      id: crypto.randomUUID(),
      cartao_id: anterior.id,
      resposta,
      estado_antes: anterior.estado,
      dias_agendados: novo.dias_agendados,
      duracao_ms: duracao,
      revisado_em: agora.toISOString(),
    }
    enfileirar(() => responderFlash.mutateAsync({ cartao: novo, revisao }))

    const m = new Map(mapa).set(novo.id, novo)
    const f = new Map(feitos)
    const d = dados.disciplinaDoCartao(anterior)
    if (anterior.estado === 0 || anterior.estado === 2) {
      const v = { ...(f.get(d) ?? { novos: 0, revisoes: 0 }) }
      if (anterior.estado === 0) v.novos++
      else v.revisoes++
      f.set(d, v)
    }
    const r = respondidos + (atual.fila === 'aprendendo' ? 0 : 1)
    setMapa(m)
    setFeitos(f)
    setRespondidos(r)
    setPassos((p) => [...p, { anterior, fila: atual.fila, revisaoId: revisao.id, resposta, duracao }])
    setAtual(proximoCartao(calcular(m, f, agora), r, agora))
    setRevelado(false)
    setMostradoEm(Date.now())
  }

  const desfazer = () => {
    const ultimo = passos[passos.length - 1]
    if (!ultimo || !mapa) return
    enfileirar(() => desfazerFlash.mutateAsync({ anterior: ultimo.anterior, revisaoId: ultimo.revisaoId }))
    const m = new Map(mapa).set(ultimo.anterior.id, ultimo.anterior)
    const f = new Map(feitos)
    const d = dados.disciplinaDoCartao(ultimo.anterior)
    if (ultimo.anterior.estado === 0 || ultimo.anterior.estado === 2) {
      const v = { ...(f.get(d) ?? { novos: 0, revisoes: 0 }) }
      if (ultimo.anterior.estado === 0) v.novos = Math.max(0, v.novos - 1)
      else v.revisoes = Math.max(0, v.revisoes - 1)
      f.set(d, v)
    }
    setMapa(m)
    setFeitos(f)
    setRespondidos((r) => Math.max(0, r - (ultimo.fila === 'aprendendo' ? 0 : 1)))
    setPassos((p) => p.slice(0, -1))
    setAtual({ cartao: ultimo.anterior, fila: ultimo.fila })
    setRevelado(false)
    setMostradoEm(Date.now())
    toast('Resposta desfeita.')
  }

  const suspenderAtual = () => {
    if (!atual || !mapa) return
    const c = atual.cartao
    atualizar.mutate({ ids: [c.id], campos: { suspenso: true } }, { onError: (e) => toast.error(mensagemErro(e)) })
    const m = new Map(mapa)
    m.delete(c.id)
    setMapa(m)
    setAtual(proximoCartao(calcular(m, feitos), respondidos))
    setRevelado(false)
    setMostradoEm(Date.now())
    toast.success('Cartão suspenso. Ele não aparece mais nas revisões até você reativar.')
  }

  // atalhos: espaço/enter mostra a resposta (e depois vale "Bom"), 1–4 respondem, Ctrl+Z desfaz, E edita
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (editando || e.defaultPrevented) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        desfazer()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (!atual) return
      if (e.key === ' ' || e.key === 'Enter') {
        if (alvo?.tagName === 'BUTTON' && e.key === 'Enter') return
        e.preventDefault()
        if (!revelado) setRevelado(true)
        else responderCom(3)
      } else if (revelado && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        responderCom(Number(e.key) as RespostaFlash)
      } else if (e.key.toLowerCase() === 'e' && nota) {
        e.preventDefault()
        setEditando(nota)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const titulo = disciplinaId ? (dados.disciplinaPorId.get(disciplinaId)?.nome ?? 'Baralho') : 'Todos os baralhos'
  const subtitulo = topicoId ? dados.topicoPorId.get(topicoId)?.nome : undefined
  const voltar = disciplinaId ? `/flashcards/${disciplinaId}` : '/flashcards'

  if (dados.carregando || !mapa) return <Carregando texto="Preparando os cartões…" />

  const sessao = {
    total: passos.length,
    acertos: passos.filter((p) => p.resposta !== 1).length,
    duracao: passos.reduce((s, p) => s + p.duracao, 0),
  }
  const topicoDoCartao = nota?.topico_id ? dados.topicoPorId.get(nota.topico_id)?.nome : undefined
  const disciplinaDoCartao = nota ? dados.disciplinaPorId.get(nota.disciplina_id) : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="sticky top-0 z-20 border-b border-linha/70 bg-fundo/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link to={voltar} aria-label="Encerrar a revisão" title="Encerrar" className="grid size-10 shrink-0 place-items-center rounded-xl text-tinta-suave hover:bg-nevoa/60 hover:text-tinta">
            <X className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-tinta">{titulo}</p>
            {subtitulo && <p className="truncate text-xs text-tinta-suave">{subtitulo}</p>}
          </div>
          <span className="flex items-center gap-2 text-[15px] font-semibold numeros" aria-label={`${cont.novos} novos, ${cont.aprendendo} aprendendo, ${cont.revisar} para revisar`}>
            <span className={cn('text-revisao', atual?.fila === 'novo' && 'underline underline-offset-4')}>{cont.novos}</span>
            <span className="text-tinta-suave/50">+</span>
            <span className={cn('text-ruim', atual?.fila === 'aprendendo' && 'underline underline-offset-4')}>{cont.aprendendo}</span>
            <span className="text-tinta-suave/50">+</span>
            <span className={cn('text-bom', atual?.fila === 'revisar' && 'underline underline-offset-4')}>{cont.revisar}</span>
          </span>
          <button
            type="button"
            onClick={desfazer}
            disabled={!passos.length}
            aria-label="Desfazer a última resposta"
            title="Desfazer (Ctrl+Z)"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-tinta-suave hover:bg-nevoa/60 hover:text-tinta disabled:opacity-30"
          >
            <Undo2 className="size-5" aria-hidden />
          </button>
          {atual && nota && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <button type="button" aria-label="Mais ações do cartão" className="grid size-10 shrink-0 place-items-center rounded-xl text-tinta-suave hover:bg-nevoa/60 hover:text-tinta">
                  <EllipsisVertical className="size-5" aria-hidden />
                </button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl">
                  <Menu.Item onSelect={() => setEditando(nota)} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] text-tinta outline-none data-[highlighted]:bg-superficie-2">
                    <Pencil className="size-4 text-tinta-suave" aria-hidden /> Editar cartão <span className="ml-auto text-xs text-tinta-suave">E</span>
                  </Menu.Item>
                  <Menu.Item onSelect={suspenderAtual} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] text-tinta outline-none data-[highlighted]:bg-superficie-2">
                    <Pause className="size-4 text-tinta-suave" aria-hidden /> Suspender cartão
                  </Menu.Item>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>
      </header>

      {atual && nota && lados ? (
        <>
          <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-5 sm:px-4 sm:py-8">
            <article className="rounded-3xl border border-linha/70 bg-superficie px-5 py-8 sm:px-10 sm:py-12" aria-live="polite">
              <p className="mb-6 flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-tinta-suave">
                {!disciplinaId && disciplinaDoCartao && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: disciplinaDoCartao.cor }} aria-hidden />
                    {disciplinaDoCartao.nome}
                  </span>
                )}
                {topicoDoCartao && <span>{topicoDoCartao}</span>}
                {atual.fila === 'novo' && <span className="rounded-md bg-revisao-fundo px-1.5 py-0.5 font-medium text-revisao">Novo</span>}
              </p>
              {revelado && lados.respostaSubstitui ? (
                <ConteudoCartao html={lados.resposta} />
              ) : (
                <ConteudoCartao html={lados.pergunta} />
              )}
              {revelado && !lados.respostaSubstitui && (
                <>
                  <hr className="my-7 border-linha" />
                  <ConteudoCartao html={lados.resposta} />
                </>
              )}
            </article>
          </main>

          <footer className="sticky bottom-0 z-20 border-t border-linha/70 bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4">
              {!revelado ? (
                <Botao className="h-12 w-full text-base" onClick={() => setRevelado(true)} autoFocus>
                  Mostrar resposta <span className="hidden text-sm font-normal opacity-80 sm:inline">(espaço)</span>
                </Botao>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {BOTOES.map((b) => (
                    <button
                      key={b.resposta}
                      type="button"
                      onClick={() => responderCom(b.resposta)}
                      className="flex flex-col items-center rounded-xl border border-linha bg-superficie py-2 transition-colors hover:bg-nevoa/50 active:scale-[0.98]"
                    >
                      <span className="text-xs text-tinta-suave numeros">{intervalos?.[b.resposta].rotulo}</span>
                      <span className={cn('text-[15px] font-semibold', b.classe)}>{b.rotulo}</span>
                      <span className="hidden text-[11px] text-tinta-suave/70 sm:block">{b.resposta}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </footer>
        </>
      ) : (
        <Fim
          sessao={sessao}
          proximo={disp ? proximoAprendizado(disp) : null}
          aprendendo={cont.aprendendo}
          voltar={() => navegar(voltar)}
          podeDesfazer={passos.length > 0}
          desfazer={desfazer}
        />
      )}

      <NotaFlashDialog aberto={editando !== null} aoMudar={(a) => !a && setEditando(null)} nota={editando} />
    </div>
  )
}

function Fim({
  sessao,
  proximo,
  aprendendo,
  voltar,
  podeDesfazer,
  desfazer,
}: {
  sessao: { total: number; acertos: number; duracao: number }
  proximo: Date | null
  aprendendo: number
  voltar: () => void
  podeDesfazer: boolean
  desfazer: () => void
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <CircleCheck className="size-12 text-bom" aria-hidden />
      <h1 className="mt-4 text-2xl text-tinta">{sessao.total ? 'Parabéns! Por hoje é só.' : 'Nada para revisar agora'}</h1>
      {sessao.total > 0 ? (
        <p className="mt-2 text-tinta-suave numeros">
          {sessao.total} {sessao.total === 1 ? 'cartão revisado' : 'cartões revisados'} em {sessao.duracao < 60_000 ? 'menos de 1 min' : formatarDuracao(sessao.duracao / 1000)} ·{' '}
          {Math.round((sessao.acertos / sessao.total) * 100)}% de acerto
        </p>
      ) : (
        <p className="mt-2 text-tinta-suave">Este baralho está em dia. Volte amanhã ou estude outro baralho.</p>
      )}
      {proximo && aprendendo > 0 && (
        <p className="mt-4 rounded-xl bg-superficie-2 px-4 py-3 text-sm text-tinta-suave numeros">
          {aprendendo} {aprendendo === 1 ? 'cartão em aprendizado volta' : 'cartões em aprendizado voltam'} às {format(proximo, 'HH:mm')}. Deixe esta tela aberta ou volte depois.
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {podeDesfazer && (
          <Botao variante="fantasma" onClick={desfazer}>
            <Undo2 className="size-4" aria-hidden /> Desfazer a última
          </Botao>
        )}
        <Botao onClick={voltar}>Voltar aos baralhos</Botao>
      </div>
    </main>
  )
}
