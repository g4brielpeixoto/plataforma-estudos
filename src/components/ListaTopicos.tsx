import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ResumoTopico } from '@/lib/indicadores'
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
  aoReordenar: (novaOrdem: Topico[]) => void
  aoAlternarConcluido: (t: Topico) => void
  aoRenomear: (t: Topico, nome: string) => Promise<boolean>
  aoExcluir: (t: Topico) => void
}

const instrucoes = {
  draggable:
    'Para mover um tópico, pressione espaço ou Enter, use as setas para cima e para baixo e pressione espaço ou Enter de novo para soltar. Esc cancela.',
}

export function ListaTopicos({ topicos, visiveis, porTopico, podeArrastar, aoReordenar, aoAlternarConcluido, aoRenomear, aoExcluir }: Props) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const posicao = new Map(topicos.map((t, i) => [t.id, i]))

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const de = posicao.get(String(active.id))
    const para = posicao.get(String(over.id))
    if (de === undefined || para === undefined) return
    aoReordenar(arrayMove(topicos, de, para))
  }

  const moverPara = (t: Topico, novaPosicao: number) => {
    const de = posicao.get(t.id)
    if (de === undefined || !Number.isFinite(novaPosicao)) return
    const para = Math.max(0, Math.min(topicos.length - 1, Math.round(novaPosicao) - 1))
    if (para === de) return
    aoReordenar(arrayMove(topicos, de, para))
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
          onDragStart: ({ active }) => `Tópico na posição ${(posicao.get(String(active.id)) ?? 0) + 1} selecionado.`,
          onDragOver: ({ over }) => (over ? `Sobre a posição ${(posicao.get(String(over.id)) ?? 0) + 1}.` : 'Fora da lista.'),
          onDragEnd: ({ over }) => (over ? `Tópico movido para a posição ${(posicao.get(String(over.id)) ?? 0) + 1}.` : 'Movimento cancelado.'),
          onDragCancel: () => 'Movimento cancelado.',
        },
      }}
    >
      <SortableContext items={visiveis.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-linha/60 p-2">
          {visiveis.map((t) => (
            <LinhaTopico
              key={t.id}
              topico={t}
              numero={(posicao.get(t.id) ?? 0) + 1}
              total={topicos.length}
              resumo={porTopico.get(t.id)}
              podeArrastar={podeArrastar}
              aoMoverPara={(n) => moverPara(t, n)}
              aoAlternarConcluido={() => aoAlternarConcluido(t)}
              aoRenomear={(nome) => aoRenomear(t, nome)}
              aoExcluir={() => aoExcluir(t)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function LinhaTopico({
  topico: t,
  numero,
  total,
  resumo: r,
  podeArrastar,
  aoMoverPara,
  aoAlternarConcluido,
  aoRenomear,
  aoExcluir,
}: {
  topico: Topico
  numero: number
  total: number
  resumo?: ResumoTopico
  podeArrastar: boolean
  aoMoverPara: (n: number) => void
  aoAlternarConcluido: () => void
  aoRenomear: (nome: string) => Promise<boolean>
  aoExcluir: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !podeArrastar })
  const [editandoNumero, setEditandoNumero] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)

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
        'group relative flex items-center gap-2 rounded-xl py-2.5 pr-1 pl-0.5 sm:gap-3 sm:px-2',
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

      {editandoNumero !== null ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={1}
          max={total}
          value={editandoNumero}
          onChange={(e) => setEditandoNumero(e.target.value)}
          onBlur={confirmarNumero}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarNumero()
            if (e.key === 'Escape') setEditandoNumero(null)
          }}
          aria-label={`Nova posição de "${t.nome}" (1 a ${total})`}
          className="h-8 w-12 shrink-0 rounded-lg border border-primaria bg-superficie px-1 text-center text-sm font-semibold text-tinta numeros focus:outline-none focus:ring-2 focus:ring-primaria/40"
        />
      ) : (
        <button
          onClick={() => setEditandoNumero(String(numero))}
          title="Toque para digitar uma nova posição"
          aria-label={`Posição ${numero}. Toque para mudar`}
          className="h-8 min-w-8 shrink-0 rounded-lg bg-superficie-2 px-1.5 text-sm font-semibold text-tinta-suave numeros hover:bg-nevoa hover:text-tinta"
        >
          {numero}
        </button>
      )}

      <input
        type="checkbox"
        className="size-5 shrink-0 cursor-pointer"
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
            <p className={cn('text-[15px] leading-snug break-words', t.concluido ? 'text-tinta-suave line-through decoration-lilas' : 'text-tinta')}>{t.nome}</p>
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
            </p>
          </>
        )}
      </div>

      {renomeando === null && (
        <div className="flex shrink-0 items-center sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <Botao variante="fantasma" tamanho="icone" aria-label={`Renomear ${t.nome}`} onClick={() => setRenomeando(t.nome)}>
            <Pencil className="size-4" />
          </Botao>
          <Botao variante="fantasma" tamanho="icone" aria-label={`Excluir ${t.nome}`} onClick={aoExcluir}>
            <Trash2 className="size-4" />
          </Botao>
        </div>
      )}
    </li>
  )
}
