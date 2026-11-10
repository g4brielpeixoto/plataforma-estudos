import * as Menu from '@radix-ui/react-dropdown-menu'
import { differenceInCalendarDays } from 'date-fns'
import { ArrowLeft, EllipsisVertical, Pause, Pencil, Play, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { NotaFlashDialog } from '@/components/flashcards/NotaFlashDialog'
import { Botao, Carregando, Confirmar, Entrada, Painel, Selecao, Vazio } from '@/components/ui'
import { useAtualizarCartoesFlash, useExcluirNotasFlash } from '@/hooks/dados'
import { filtroEscopo, useDadosFlash } from '@/hooks/useFlash'
import { camposDeNovo } from '@/lib/flashcards/agenda'
import { contagem } from '@/lib/flashcards/fila'
import { textoPuro } from '@/lib/flashcards/html'
import { semMarcas } from '@/lib/flashcards/omissao'
import { rotuloSelecao } from '@/lib/topicos'
import { cn, mensagemErro, normalizar } from '@/lib/utils'
import type { FlashCartao, FlashNota } from '@/types'

type FiltroEstado = 'todos' | 'novos' | 'aprendendo' | 'revisao' | 'suspensos'
const POR_PAGINA = 50

/** Quando a nota volta: "novo", "hoje", "amanhã", "em 12 dias", "suspenso" */
function proximaRevisao(cartoes: FlashCartao[]) {
  const ativos = cartoes.filter((c) => !c.suspenso)
  if (!ativos.length) return { texto: 'Suspenso', ordem: Number.MAX_SAFE_INTEGER }
  if (ativos.every((c) => c.estado === 0)) return { texto: 'Novo', ordem: Number.MAX_SAFE_INTEGER - 1 }
  const vence = Math.min(...ativos.filter((c) => c.estado !== 0).map((c) => new Date(c.vence_em).getTime()))
  const dias = differenceInCalendarDays(new Date(vence), new Date())
  return { texto: dias <= 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`, ordem: vence }
}

export function BaralhoFlash() {
  const { id = '' } = useParams()
  const dados = useDadosFlash()
  const navegar = useNavigate()
  const atualizar = useAtualizarCartoesFlash()
  const excluir = useExcluirNotasFlash()

  const [topicoEstudo, setTopicoEstudo] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroTopico, setFiltroTopico] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [editando, setEditando] = useState<FlashNota | null>(null)
  const [criando, setCriando] = useState(false)
  const [excluindo, setExcluindo] = useState<FlashNota | null>(null)

  const disciplina = dados.disciplinaPorId.get(id)
  const notasDoBaralho = useMemo(() => dados.notas.filter((n) => n.disciplina_id === id), [dados.notas, id])
  const topicosDoBaralho = useMemo(() => dados.topicos.filter((t) => t.disciplina_id === id), [dados.topicos, id])
  const topicosComNotas = useMemo(() => {
    const usados = new Set(notasDoBaralho.map((n) => n.topico_id))
    return topicosDoBaralho.filter((t) => usados.has(t.id))
  }, [notasDoBaralho, topicosDoBaralho])

  const cont = contagem(dados.disponiveisEm(filtroEscopo(id, topicoEstudo || null)))
  const temParaHoje = cont.novos + cont.aprendendo + cont.revisar > 0

  const lista = useMemo(() => {
    const termo = normalizar(busca)
    return notasDoBaralho
      .filter((n) => !filtroTopico || (filtroTopico === 'sem' ? !n.topico_id : n.topico_id === filtroTopico))
      .filter((n) => {
        if (filtroEstado === 'todos') return true
        const cs = dados.cartoesPorNota.get(n.id) ?? []
        if (filtroEstado === 'suspensos') return cs.some((c) => c.suspenso)
        if (filtroEstado === 'novos') return cs.some((c) => !c.suspenso && c.estado === 0)
        if (filtroEstado === 'aprendendo') return cs.some((c) => !c.suspenso && (c.estado === 1 || c.estado === 3))
        return cs.some((c) => !c.suspenso && c.estado === 2)
      })
      .filter((n) => !termo || normalizar(`${textoPuro(semMarcas(n.frente))} ${textoPuro(n.verso)}`).includes(termo))
      .map((n) => ({ nota: n, cartoes: dados.cartoesPorNota.get(n.id) ?? [] }))
  }, [notasDoBaralho, filtroTopico, filtroEstado, busca, dados.cartoesPorNota])

  if (dados.carregando) return <Carregando />
  if (!disciplina) {
    return (
      <Vazio
        titulo="Baralho não encontrado"
        texto="A disciplina pode ter sido excluída."
        acao={
          <Link to="/flashcards" className="font-medium text-primaria-forte hover:underline dark:text-primaria">
            Voltar aos flashcards
          </Link>
        }
      />
    )
  }

  const suspender = (n: FlashNota, suspenso: boolean) =>
    atualizar.mutate(
      { ids: (dados.cartoesPorNota.get(n.id) ?? []).map((c) => c.id), campos: { suspenso } },
      { onSuccess: () => toast.success(suspenso ? 'Cartão suspenso.' : 'Cartão reativado.'), onError: (e) => toast.error(mensagemErro(e)) },
    )
  const esquecer = (n: FlashNota) =>
    atualizar.mutate(
      { ids: (dados.cartoesPorNota.get(n.id) ?? []).map((c) => c.id), campos: camposDeNovo() },
      { onSuccess: () => toast.success('O cartão voltou a ser novo.'), onError: (e) => toast.error(mensagemErro(e)) },
    )

  return (
    <>
      <Link to="/flashcards" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden /> Flashcards
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 font-serif text-[1.85rem] leading-tight font-medium text-tinta">
            <span className="size-3 shrink-0 rounded-full" style={{ background: disciplina.cor }} aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{disciplina.nome}</span>
          </h1>
          <p className="mt-1 text-tinta-suave numeros">
            {notasDoBaralho.length} {notasDoBaralho.length === 1 ? 'nota' : 'notas'} · {notasDoBaralho.reduce((s, n) => s + (dados.cartoesPorNota.get(n.id)?.length ?? 0), 0)} cartões
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/edital/${disciplina.id}`} className="inline-flex h-10 items-center rounded-xl px-3 text-[15px] font-medium text-tinta-suave hover:bg-nevoa/60 hover:text-tinta">
            Ver no edital
          </Link>
          <Botao variante="secundario" onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden /> Novo cartão
          </Botao>
        </div>
      </header>

      {/* visão geral, como a tela do baralho no Anki */}
      <Painel className="mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <dl className="flex gap-8">
            {(
              [
                ['Novos', cont.novos, 'text-revisao'],
                ['Aprendendo', cont.aprendendo, 'text-ruim'],
                ['Revisar', cont.revisar, 'text-bom'],
              ] as [string, number, string][]
            ).map(([r, n, cor]) => (
              <div key={r}>
                <dt className="text-sm text-tinta-suave">{r}</dt>
                <dd className={cn('text-3xl font-semibold numeros', n ? cor : 'text-tinta-suave/50')}>{n}</dd>
              </div>
            ))}
          </dl>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {topicosComNotas.length > 0 && (
              <Selecao aria-label="Estudar só um tópico" value={topicoEstudo} onChange={(e) => setTopicoEstudo(e.target.value)} className="text-sm sm:w-64">
                <option value="">Todos os tópicos</option>
                {topicosComNotas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {rotuloSelecao(t)}
                  </option>
                ))}
              </Selecao>
            )}
            <Botao
              disabled={!temParaHoje}
              onClick={() => navegar(`/flashcards/estudar/${disciplina.id}${topicoEstudo ? `?topico=${topicoEstudo}` : ''}`)}
              className="h-11 px-6"
            >
              <Play className="size-4" fill="currentColor" aria-hidden /> {temParaHoje ? 'Estudar agora' : 'Tudo em dia por hoje'}
            </Botao>
          </div>
        </div>
      </Painel>

      {/* navegador de cartões */}
      <Painel className="overflow-hidden">
        <div className="grid grid-cols-1 gap-2 border-b border-linha/70 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,11rem)] sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
            <Entrada
              type="search"
              placeholder="Buscar nos cartões"
              aria-label="Buscar nos cartões"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setLimite(POR_PAGINA)
              }}
              className="pl-9"
            />
          </div>
          <Selecao aria-label="Filtrar por tópico" value={filtroTopico} onChange={(e) => setFiltroTopico(e.target.value)} className="text-sm">
            <option value="">Todos os tópicos</option>
            <option value="sem">Sem tópico</option>
            {topicosComNotas.map((t) => (
              <option key={t.id} value={t.id}>
                {rotuloSelecao(t)}
              </option>
            ))}
          </Selecao>
          <Selecao aria-label="Filtrar por situação" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)} className="text-sm">
            <option value="todos">Todas as situações</option>
            <option value="novos">Novos</option>
            <option value="aprendendo">Aprendendo</option>
            <option value="revisao">Em revisão</option>
            <option value="suspensos">Suspensos</option>
          </Selecao>
        </div>

        {lista.length === 0 ? (
          <Vazio
            titulo={notasDoBaralho.length ? 'Nenhum cartão com esses filtros' : 'Este baralho ainda não tem cartões'}
            texto={notasDoBaralho.length ? 'Mude a busca ou os filtros.' : 'Crie um cartão ou importe do Anki na tela de Flashcards.'}
          />
        ) : (
          <>
            <ul className="divide-y divide-linha/60">
              {lista.slice(0, limite).map(({ nota, cartoes }) => {
                const prox = proximaRevisao(cartoes)
                const suspensa = cartoes.length > 0 && cartoes.every((c) => c.suspenso)
                const topico = nota.topico_id ? dados.topicoPorId.get(nota.topico_id) : undefined
                return (
                  <li key={nota.id} className={cn('flex items-start gap-3 px-4 py-3 sm:px-5', suspensa && 'opacity-60')}>
                    <button type="button" onClick={() => setEditando(nota)} className="min-w-0 flex-1 text-left" aria-label={`Editar cartão: ${textoPuro(semMarcas(nota.frente)).slice(0, 80)}`}>
                      <p className="line-clamp-2 text-[15px] text-tinta [overflow-wrap:anywhere]">{textoPuro(semMarcas(nota.frente)) || '(sem texto)'}</p>
                      {nota.tipo === 'basico' && <p className="mt-0.5 line-clamp-1 text-sm text-tinta-suave [overflow-wrap:anywhere]">{textoPuro(nota.verso)}</p>}
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-tinta-suave">
                        <span>{nota.tipo === 'omissao' ? `Omissão · ${cartoes.length} ${cartoes.length === 1 ? 'cartão' : 'cartões'}` : 'Frente e verso'}</span>
                        {topico && <span className="truncate">{topico.nome}</span>}
                      </p>
                    </button>
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium numeros',
                        prox.texto === 'Hoje' ? 'bg-bom-fundo text-bom' : prox.texto === 'Novo' ? 'bg-revisao-fundo text-revisao' : 'bg-superficie-2 text-tinta-suave',
                      )}
                    >
                      {prox.texto}
                    </span>
                    <MenuNota
                      suspensa={suspensa}
                      aoEditar={() => setEditando(nota)}
                      aoSuspender={() => suspender(nota, !suspensa)}
                      aoEsquecer={() => esquecer(nota)}
                      aoExcluir={() => setExcluindo(nota)}
                    />
                  </li>
                )
              })}
            </ul>
            {lista.length > limite && (
              <div className="border-t border-linha/60 p-3 text-center">
                <Botao variante="fantasma" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                  Mostrar mais ({(lista.length - limite).toLocaleString('pt-BR')})
                </Botao>
              </div>
            )}
          </>
        )}
      </Painel>

      <NotaFlashDialog aberto={criando} aoMudar={setCriando} disciplinaInicial={disciplina.id} topicoInicial={filtroTopico && filtroTopico !== 'sem' ? filtroTopico : null} />
      <NotaFlashDialog aberto={editando !== null} aoMudar={(a) => !a && setEditando(null)} nota={editando} />
      <Confirmar
        aberto={excluindo !== null}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir este cartão?"
        texto={excluindo?.tipo === 'omissao' ? 'A nota e todos os cartões de omissão dela são apagados, com o histórico de revisões.' : 'O cartão e o histórico de revisões dele são apagados.'}
        textoBotao="Excluir"
        carregando={excluir.isPending}
        aoConfirmar={() =>
          excluindo &&
          excluir.mutate([excluindo.id], {
            onSuccess: () => {
              toast.success('Cartão excluído.')
              setExcluindo(null)
            },
            onError: (e) => toast.error(mensagemErro(e)),
          })
        }
      />
    </>
  )
}

function ItemMenu({ icone, children, onSelect, perigo }: { icone: ReactNode; children: ReactNode; onSelect: () => void; perigo?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] outline-none select-none data-[highlighted]:bg-superficie-2', perigo ? 'text-ruim' : 'text-tinta')}
    >
      <span className={perigo ? 'text-ruim' : 'text-tinta-suave'}>{icone}</span>
      {children}
    </Menu.Item>
  )
}

function MenuNota({ suspensa, aoEditar, aoSuspender, aoEsquecer, aoExcluir }: { suspensa: boolean; aoEditar: () => void; aoSuspender: () => void; aoEsquecer: () => void; aoExcluir: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" aria-label="Mais ações" className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta data-[state=open]:bg-nevoa/60">
          <EllipsisVertical className="size-4" aria-hidden />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl">
          <ItemMenu icone={<Pencil className="size-4" />} onSelect={aoEditar}>
            Editar
          </ItemMenu>
          <ItemMenu icone={suspensa ? <Play className="size-4" /> : <Pause className="size-4" />} onSelect={aoSuspender}>
            {suspensa ? 'Reativar' : 'Suspender'}
          </ItemMenu>
          <ItemMenu icone={<RotateCcw className="size-4" />} onSelect={aoEsquecer}>
            Esquecer (voltar a novo)
          </ItemMenu>
          <Menu.Separator className="my-1 h-px bg-linha/70" />
          <ItemMenu icone={<Trash2 className="size-4" />} onSelect={aoExcluir} perigo>
            Excluir
          </ItemMenu>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
