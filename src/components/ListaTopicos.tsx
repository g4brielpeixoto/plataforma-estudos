import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EllipsisVertical, GripVertical, IndentDecrease, IndentIncrease, ListPlus, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { ResumoTopico } from '@/lib/indicadores'
import { definirNivel, filhosDe, moverParaPosicao, moverPorArrasto, numeracao, paiDe, podeRecuar } from '@/lib/topicos'
import { cn, formatarDuracao } from '@/lib/utils'
import type { Topico } from '@/types'
import { Botao, Entrada, SeloAcerto } from './ui'

interface Props {
  /** todos os tópicos da disciplina, já na ordem */
  topicos: Topico[]
  /** os que aparecem no filtro atual */
  visiveis: Topico[]
  porTopico: Map<string, ResumoTopico>
  /** arrastar só faz sentido com a lista completa */
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

export function ListaTopicos({ topicos, visiveis, porTopico, podeArrastar, aoReordenar, aoAlternarConcluido, aoRenomear, aoExcluir, aoAdicionarSubtopico }: Props) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const numeros = numeracao(topicos)

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
      <SortableContext items={visiveis.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="p-2">
          {visiveis.map((t) => {
            const pai = t.nivel === 1 ? paiDe(topicos, t.id) : undefined
            const irmaos = pai ? filhosDe(topicos, pai.id).length : topicos.filter((x) => x.nivel === 0).length
            return (
              <LinhaTopico
                key={t.id}
                topico={t}
                numero={numeros.get(t.id) ?? ''}
                maximo={irmaos}
                nomePai={pai?.nome}
                qtdFilhos={t.nivel === 0 ? filhosDe(topicos, t.id).length : 0}
                resumo={porTopico.get(t.id)}
                podeArrastar={podeArrastar}
                podeRecuar={podeRecuar(topicos, t.id)}
                aoMoverPara={(n) => {
                  const nova = moverParaPosicao(topicos, t.id, n)
                  if (nova !== topicos) aoReordenar(nova)
                }}
                aoMudarNivel={(nivel) => aoReordenar(definirNivel(topicos, t.id, nivel))}
                aoAlternarConcluido={() => aoAlternarConcluido(t)}
                aoRenomear={(nome) => aoRenomear(t, nome)}
                aoExcluir={() => aoExcluir(t)}
                aoAdicionarSubtopico={() => aoAdicionarSubtopico(t)}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
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
  podeRecuar,
  aoMoverPara,
  aoMudarNivel,
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
  podeRecuar: boolean
  aoMoverPara: (n: number) => void
  aoMudarNivel: (nivel: 0 | 1) => void
  aoAlternarConcluido: () => void
  aoRenomear: (nome: string) => Promise<boolean>
  aoExcluir: () => void
  aoAdicionarSubtopico: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !podeArrastar })
  const [editandoNumero, setEditandoNumero] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const sub = t.nivel === 1
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
        'group relative flex items-center gap-2 rounded-xl py-2.5 pr-0.5 pl-0.5 sm:gap-3 sm:px-2',
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
          className="-mr-1 flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-lilas hover:text-tinta-suave active:cursor-grabbing sm:mr-0"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}

      {/* recuo do subtópico, com uma linha guia ligando ao tópico de cima */}
      {sub && <span aria-hidden className="ml-1 h-9 w-5 shrink-0 rounded-bl-lg border-b-2 border-l-2 border-nevoa sm:ml-2 sm:w-6 -translate-y-3" />}

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
            sub ? 'min-w-9 bg-transparent text-xs text-tinta-suave ring-1 ring-linha ring-inset' : 'min-w-8 bg-superficie-2 text-sm text-tinta-suave',
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

      <div className="min-w-0 flex-1">
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
                sub ? 'text-[14.5px]' : 'text-[15px] font-medium',
                t.concluido ? 'text-tinta-suave line-through decoration-lilas' : 'text-tinta',
              )}
            >
              {t.nome}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave numeros">
              {r ? (
                <>
                  {r.tempoSegundos > 0 && <span>{formatarDuracao(r.tempoSegundos)}</span>}
                  {r.questoesFeitas > 0 && (
                    <span className="inline-flex items-center gap-1">
                      {r.questoesAcertadas}/{r.questoesFeitas} <SeloAcerto pct={r.acertoPct} className="px-1 py-0 text-xs" />
                    </span>
                  )}
                  {r.ultimoEstudo && <span>há {formatDistanceToNowStrict(new Date(r.ultimoEstudo), { locale: ptBR })}</span>}
                </>
              ) : (
                <span>Ainda não estudado</span>
              )}
              {qtdFilhos > 0 && <span>· {qtdFilhos === 1 ? '1 subtópico' : `${qtdFilhos} subtópicos`}</span>}
            </p>
          </>
        )}
      </div>

      {renomeando === null && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Botao variante="fantasma" tamanho="icone" aria-label={`Ações de ${t.nome}`} className="shrink-0">
              <EllipsisVertical className="size-[18px]" />
            </Botao>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl">
              {!sub && (
                <ItemMenu icone={<ListPlus className="size-4" />} onSelect={aoAdicionarSubtopico}>
                  Adicionar subtópico
                </ItemMenu>
              )}
              {podeRecuar && (
                <ItemMenu icone={<IndentIncrease className="size-4" />} onSelect={() => aoMudarNivel(1)}>
                  Tornar subtópico do de cima
                </ItemMenu>
              )}
              {sub && (
                <ItemMenu icone={<IndentDecrease className="size-4" />} onSelect={() => aoMudarNivel(0)}>
                  Transformar em tópico
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
