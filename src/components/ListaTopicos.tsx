import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { format } from 'date-fns'
import { ChevronRight, EllipsisVertical, GripVertical, IndentDecrease, IndentIncrease, ListPlus, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { somarResumos, type ResumoTopico } from '@/lib/indicadores'
import { avancar, descendentesDe, filhosDe, irmaosDe, moverParaPosicao, moverPorArrasto, NIVEL_MAXIMO, numeracao, paiDe, podeRecuar, recuar } from '@/lib/topicos'
import { cn, formatarDuracao } from '@/lib/utils'
import type { Topico } from '@/types'
import { Botao, Entrada, SeloAcerto } from './ui'

interface Props {
  /** todos os tópicos da disciplina, já na ordem */
  topicos: Topico[]
  /** os que aparecem no filtro atual */
  visiveis: Topico[]
  porTopico: Map<string, ResumoTopico>
  /** arrastar e recolher só fazem sentido com a lista completa */
  podeArrastar: boolean
  /** recebe a lista inteira na nova ordem (e com os níveis atualizados) */
  aoReordenar: (novaOrdem: Topico[]) => void
  aoAlternarConcluido: (t: Topico) => void
  aoRenomear: (t: Topico, nome: string) => Promise<boolean>
  aoExcluir: (t: Topico) => void
  aoAdicionarSubtopico: (pai: Topico) => void
}

const instrucoes = {
  draggable:
    'Para mover um tópico, pressione espaço ou Enter, use as setas para cima e para baixo e pressione espaço ou Enter de novo para soltar. Esc cancela. Um tópico leva junto os seus subtópicos.',
}

/** Tópicos recolhidos ficam salvos no navegador, por disciplina */
function useRecolhidos(disciplinaId: string | undefined) {
  const chave = `recolhidos:${disciplinaId ?? ''}`
  const ler = () => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(chave) ?? '[]'))
    } catch {
      return new Set<string>()
    }
  }
  const [recolhidos, setRecolhidos] = useState<Set<string>>(ler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setRecolhidos(ler()), [chave])
  const salvar = (novo: Set<string>) => {
    setRecolhidos(novo)
    try {
      localStorage.setItem(chave, JSON.stringify([...novo]))
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }
  return [recolhidos, salvar] as const
}

export function ListaTopicos({ topicos, visiveis, porTopico, podeArrastar, aoReordenar, aoAlternarConcluido, aoRenomear, aoExcluir, aoAdicionarSubtopico }: Props) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const numeros = useMemo(() => numeracao(topicos), [topicos])
  const [recolhidos, setRecolhidos] = useRecolhidos(topicos[0]?.disciplina_id)

  const comFilhos = useMemo(() => new Set(topicos.filter((t) => filhosDe(topicos, t.id).length > 0).map((t) => t.id)), [topicos])
  const ocultos = useMemo(() => {
    const s = new Set<string>()
    for (const id of recolhidos) if (comFilhos.has(id)) for (const d of descendentesDe(topicos, id)) s.add(d.id)
    return s
  }, [recolhidos, comFilhos, topicos])
  const exibidos = podeArrastar ? visiveis.filter((t) => !ocultos.has(t.id)) : visiveis
  const algumRecolhido = [...recolhidos].some((id) => comFilhos.has(id))

  const alternarRecolhido = (id: string) => {
    const novo = new Set(recolhidos)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    setRecolhidos(novo)
  }

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const nova = moverPorArrasto(topicos, String(active.id), String(over.id))
    if (nova !== topicos) aoReordenar(nova)
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={aoSoltar}
      accessibility={{
        screenReaderInstructions: instrucoes,
        announcements: {
          onDragStart: ({ active }) => `Tópico ${numeros.get(String(active.id)) ?? ''} selecionado.`,
          onDragOver: ({ over }) => (over ? `Sobre o tópico ${numeros.get(String(over.id)) ?? ''}.` : 'Fora da lista.'),
          onDragEnd: ({ over }) => (over ? `Tópico solto perto do ${numeros.get(String(over.id)) ?? ''}.` : 'Movimento cancelado.'),
          onDragCancel: () => 'Movimento cancelado.',
        },
      }}
    >
      <SortableContext items={exibidos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex items-center gap-3 px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-tinta-suave uppercase">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="hidden md:inline" aria-hidden>
              Tópico
            </span>
            {podeArrastar && comFilhos.size > 0 && (
              <button
                onClick={() => setRecolhidos(algumRecolhido ? new Set() : new Set(comFilhos))}
                className="rounded-md px-1.5 py-0.5 text-xs font-medium tracking-normal normal-case text-primaria-forte hover:bg-superficie-2 dark:text-primaria"
              >
                {algumRecolhido ? 'Expandir tudo' : 'Recolher tudo'}
              </button>
            )}
          </span>
          <span className={cn(COL_QUESTOES, 'hidden md:block')} aria-hidden>
            Questões
          </span>
          <span className={cn(COL_DATA, 'hidden md:block')} aria-hidden>
            Último estudo
          </span>
          <span className={cn(COL_ESTUDO, 'hidden md:block')} aria-hidden>
            Estudo
          </span>
          <span className="hidden w-9 shrink-0 md:block" />
        </div>
        <ul className="p-2">
          {exibidos.map((t) => {
            const pai = paiDe(topicos, t.id)
            const descendentes = descendentesDe(topicos, t.id)
            return (
              <LinhaTopico
                key={t.id}
                topico={t}
                numero={numeros.get(t.id) ?? ''}
                maximo={irmaosDe(topicos, t.id).length}
                nomePai={pai?.nome}
                qtdFilhos={filhosDe(topicos, t.id).length}
                resumo={descendentes.length ? somarResumos([porTopico.get(t.id), ...descendentes.map((f) => porTopico.get(f.id))]) : porTopico.get(t.id)}
                podeArrastar={podeArrastar}
                recolhido={podeArrastar && comFilhos.has(t.id) ? recolhidos.has(t.id) : undefined}
                aoAlternarRecolhido={() => alternarRecolhido(t.id)}
                podeRecuar={podeRecuar(topicos, t.id)}
                aoMoverPara={(n) => {
                  const nova = moverParaPosicao(topicos, t.id, n)
                  if (nova !== topicos) aoReordenar(nova)
                }}
                aoRecuar={() => aoReordenar(recuar(topicos, t.id))}
                aoAvancar={() => aoReordenar(avancar(topicos, t.id))}
                aoAlternarConcluido={() => aoAlternarConcluido(t)}
                aoRenomear={(nome) => aoRenomear(t, nome)}
                aoExcluir={() => aoExcluir(t)}
                aoAdicionarSubtopico={() => {
                  if (recolhidos.has(t.id)) alternarRecolhido(t.id)
                  aoAdicionarSubtopico(t)
                }}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

const COL_QUESTOES = 'w-28 shrink-0 text-center'
const COL_DATA = 'w-24 shrink-0 text-center'
const COL_ESTUDO = 'w-24 shrink-0 text-center'

const dataCurta = (iso: string) => format(new Date(iso), 'dd/MM/yy')

function Traco() {
  return (
    <span className="text-lilas" aria-label="sem registro">
      —
    </span>
  )
}

/** "6/10 60%": acertos em verde, total e selo de aproveitamento */
function Questoes({ r }: { r: ResumoTopico }) {
  return (
    <span className="inline-flex items-center gap-1.5 numeros">
      <span>
        <span className="font-semibold text-bom">{r.questoesAcertadas}</span>
        <span className="text-tinta-suave">/{r.questoesFeitas}</span>
      </span>
      <SeloAcerto pct={r.acertoPct} className="px-1.5 py-0 text-xs" />
    </span>
  )
}

/** "1h05min 2×": tempo total e quantas vezes o tópico foi estudado */
function TempoSessoes({ r }: { r: ResumoTopico }) {
  return (
    <span className="inline-flex items-baseline gap-1 numeros" title={`${r.sessoes} ${r.sessoes === 1 ? 'sessão de estudo' : 'sessões de estudo'}`}>
      <span className="text-tinta">{r.tempoSegundos > 0 ? formatarDuracao(r.tempoSegundos) : '0min'}</span>
      <span className="text-xs text-tinta-suave">{r.sessoes}×</span>
    </span>
  )
}

function ItemMenu({ icone, children, onSelect, perigo }: { icone: ReactNode; children: ReactNode; onSelect: () => void; perigo?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] outline-none select-none data-[highlighted]:bg-superficie-2',
        perigo ? 'text-ruim' : 'text-tinta',
      )}
    >
      <span className={perigo ? 'text-ruim' : 'text-tinta-suave'}>{icone}</span>
      {children}
    </Menu.Item>
  )
}

function LinhaTopico({
  topico: t,
  numero,
  maximo,
  nomePai,
  qtdFilhos,
  resumo: r,
  podeArrastar,
  recolhido,
  aoAlternarRecolhido,
  podeRecuar,
  aoMoverPara,
  aoRecuar,
  aoAvancar,
  aoAlternarConcluido,
  aoRenomear,
  aoExcluir,
  aoAdicionarSubtopico,
}: {
  topico: Topico
  numero: string
  maximo: number
  nomePai?: string
  qtdFilhos: number
  resumo?: ResumoTopico
  podeArrastar: boolean
  /** undefined = não tem filhos (ou a lista está filtrada) */
  recolhido?: boolean
  aoAlternarRecolhido: () => void
  podeRecuar: boolean
  aoMoverPara: (n: number) => void
  aoRecuar: () => void
  aoAvancar: () => void
  aoAlternarConcluido: () => void
  aoRenomear: (nome: string) => Promise<boolean>
  aoExcluir: () => void
  aoAdicionarSubtopico: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !podeArrastar })
  const [editandoNumero, setEditandoNumero] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const sub = t.nivel > 0
  const posicaoAtual = numero.split('.').pop() ?? ''

  const confirmarNumero = () => {
    if (editandoNumero !== null && editandoNumero.trim() !== '') aoMoverPara(Number(editandoNumero))
    setEditandoNumero(null)
  }

  const salvarNome = async (e: FormEvent) => {
    e.preventDefault()
    if (!renomeando?.trim()) return
    if (await aoRenomear(renomeando)) setRenomeando(null)
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative flex items-center gap-1.5 rounded-xl py-2.5 pr-0.5 pl-0.5 sm:gap-2.5 sm:px-2',
        !sub && 'mt-1 before:absolute before:inset-x-2 before:-top-0.5 before:h-px before:bg-linha/60 first:mt-0 first:before:hidden',
        isDragging ? 'z-10 bg-superficie shadow-lg ring-1 ring-lilas' : 'hover:bg-superficie-2/70',
      )}
    >
      {podeArrastar && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar "${t.nome}" para mudar a ordem`}
          className="flex h-9 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-lilas hover:text-tinta-suave active:cursor-grabbing sm:w-6"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}

      {/* recuo: uma linha guia ligando ao item de cima, mais funda a cada nível */}
      {sub && (
        <span
          aria-hidden
          className="h-9 w-3.5 shrink-0 -translate-y-3 rounded-bl-lg border-b-2 border-l-2 border-nevoa sm:w-5"
          style={{ marginLeft: `calc(${t.nivel - 1} * var(--recuo-nivel))` }}
        />
      )}

      {podeArrastar && (
        <span className="flex w-5 shrink-0 justify-center">
          {recolhido !== undefined && (
            <button
              onClick={aoAlternarRecolhido}
              aria-expanded={!recolhido}
              aria-label={recolhido ? `Mostrar os ${qtdFilhos} subtópicos de "${t.nome}"` : `Esconder os subtópicos de "${t.nome}"`}
              className="grid size-6 place-items-center rounded-md text-tinta-suave hover:bg-nevoa hover:text-tinta"
            >
              <ChevronRight className={cn('size-4 transition-transform', !recolhido && 'rotate-90')} aria-hidden />
            </button>
          )}
        </span>
      )}

      {editandoNumero !== null ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={1}
          max={maximo}
          value={editandoNumero}
          onChange={(e) => setEditandoNumero(e.target.value)}
          onBlur={confirmarNumero}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarNumero()
            if (e.key === 'Escape') setEditandoNumero(null)
          }}
          aria-label={sub ? `Nova posição de "${t.nome}" dentro de "${nomePai ?? ''}" (1 a ${maximo})` : `Nova posição de "${t.nome}" (1 a ${maximo})`}
          className="h-8 w-12 shrink-0 rounded-lg border border-primaria bg-superficie px-1 text-center text-sm font-semibold text-tinta numeros focus:outline-none focus:ring-2 focus:ring-primaria/40"
        />
      ) : (
        <button
          onClick={() => setEditandoNumero(posicaoAtual)}
          title={sub ? `Toque para mudar a posição dentro de "${nomePai ?? ''}"` : 'Toque para digitar uma nova posição'}
          aria-label={`Posição ${numero}. Toque para mudar`}
          className={cn(
            'h-8 shrink-0 rounded-lg px-1.5 font-semibold numeros hover:bg-nevoa hover:text-tinta',
            t.nivel === 0 && 'min-w-8 bg-superficie-2 text-sm text-tinta-suave',
            t.nivel === 1 && 'min-w-9 bg-transparent text-xs text-tinta-suave ring-1 ring-linha ring-inset',
            t.nivel === 2 && 'min-w-10 bg-transparent px-1 text-[11px] text-tinta-suave ring-1 ring-linha ring-inset',
          )}
        >
          {numero}
        </button>
      )}

      <input
        type="checkbox"
        className="shrink-0"
        checked={t.concluido}
        onChange={aoAlternarConcluido}
        aria-label={t.concluido ? `Desmarcar ${t.nome}` : `Marcar ${t.nome} como concluído`}
      />

      <div className="min-w-0 flex-1 pl-0.5">
        {renomeando !== null ? (
          <form onSubmit={salvarNome} className="flex gap-2">
            <Entrada
              autoFocus
              className="h-9"
              value={renomeando}
              onChange={(e) => setRenomeando(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setRenomeando(null)}
              aria-label="Nome do tópico"
            />
            <Botao type="submit" tamanho="sm">
              Salvar
            </Botao>
          </form>
        ) : (
          <>
            <p
              className={cn(
                'leading-snug break-words',
                t.nivel === 0 && 'text-[15px] font-medium',
                t.nivel === 1 && 'text-[14.5px]',
                t.nivel === 2 && 'text-sm',
                t.concluido ? 'text-tinta-suave line-through decoration-lilas' : 'text-tinta',
              )}
            >
              {t.nome}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm text-tinta-suave numeros">
              <span className="contents md:hidden">
                {r ? (
                  <>
                    {r.questoesFeitas > 0 && <Questoes r={r} />}
                    {r.ultimoEstudo && <span>{dataCurta(r.ultimoEstudo)}</span>}
                    <TempoSessoes r={r} />
                  </>
                ) : (
                  <span>Ainda não estudado</span>
                )}
              </span>
              {qtdFilhos > 0 && (
                <span>
                  <span className="md:hidden">· </span>
                  {qtdFilhos === 1 ? '1 subtópico' : `${qtdFilhos} subtópicos`}
                </span>
              )}
            </p>
          </>
        )}
      </div>

      <div className={cn(COL_QUESTOES, 'hidden text-sm md:flex md:justify-center')} title={qtdFilhos ? 'Inclui os subtópicos' : undefined}>
        {r && r.questoesFeitas > 0 ? <Questoes r={r} /> : <Traco />}
      </div>
      <div className={cn(COL_DATA, 'hidden text-sm text-tinta-suave numeros md:block')} title={qtdFilhos ? 'Inclui os subtópicos' : undefined}>
        {r?.ultimoEstudo ? dataCurta(r.ultimoEstudo) : <Traco />}
      </div>
      <div className={cn(COL_ESTUDO, 'hidden text-sm md:flex md:justify-center')} title={qtdFilhos ? 'Inclui os subtópicos' : undefined}>
        {r ? <TempoSessoes r={r} /> : <Traco />}
      </div>

      {renomeando !== null && <span className="hidden w-9 shrink-0 md:block" />}
      {renomeando === null && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Botao variante="fantasma" tamanho="icone" aria-label={`Ações de ${t.nome}`} className="shrink-0">
              <EllipsisVertical className="size-[18px]" />
            </Botao>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={4} className="z-50 min-w-60 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl">
              {t.nivel < NIVEL_MAXIMO && (
                <ItemMenu icone={<ListPlus className="size-4" />} onSelect={aoAdicionarSubtopico}>
                  {t.nivel === 0 ? 'Adicionar subtópico' : 'Adicionar subtópico dentro deste'}
                </ItemMenu>
              )}
              {podeRecuar && (
                <ItemMenu icone={<IndentIncrease className="size-4" />} onSelect={aoRecuar}>
                  {t.nivel === 0 ? 'Tornar subtópico do de cima' : 'Colocar dentro do subtópico de cima'}
                </ItemMenu>
              )}
              {sub && (
                <ItemMenu icone={<IndentDecrease className="size-4" />} onSelect={aoAvancar}>
                  {t.nivel === 1 ? 'Transformar em tópico' : 'Transformar em subtópico'}
                </ItemMenu>
              )}
              <ItemMenu icone={<Pencil className="size-4" />} onSelect={() => setRenomeando(t.nome)}>
                Renomear
              </ItemMenu>
              <Menu.Separator className="my-1 h-px bg-linha/70" />
              <ItemMenu icone={<Trash2 className="size-4" />} onSelect={aoExcluir} perigo>
                Excluir
              </ItemMenu>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      )}
    </li>
  )
}
