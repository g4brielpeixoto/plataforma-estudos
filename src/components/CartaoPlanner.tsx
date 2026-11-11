import * as Menu from '@radix-ui/react-dropdown-menu'
import { CircleAlert, ArrowRight, CalendarArrowUp, Check, Clock, EllipsisVertical, Pencil, Play, Redo2, Trash2 } from 'lucide-react'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { amanhaChave, atrasado, concluido, COR_TIPO, hojeChave, proximaSemanaChave, ROTULO_TIPO, rotuloMinutos } from '@/lib/planner'
import { cn } from '@/lib/utils'
import type { Disciplina, ItemPlanner, Topico } from '@/types'
import type { AcoesPlanner } from '@/hooks/usePlannerAcoes'

/** Botão redondo de check do planner */
export function CheckPlanner({ feito, aoClicar, rotulo, className }: { feito: boolean; aoClicar: () => void; rotulo: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={feito}
      aria-label={feito ? `Desmarcar: ${rotulo}` : `Marcar como feito: ${rotulo}`}
      title={feito ? 'Desmarcar' : 'Marcar como feito'}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
        feito ? 'border-visto bg-visto text-superficie' : 'border-tinta-suave/45 bg-superficie text-transparent hover:border-visto hover:text-visto',
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
    </button>
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

/** Menu ⋮ do item: editar, mover e excluir */
export function MenuPlanner({ item, acoes, rotulo, className }: { item: ItemPlanner; acoes: AcoesPlanner; rotulo: string; className?: string }) {
  const hoje = hojeChave()
  const amanha = amanhaChave()
  const proxima = proximaSemanaChave()
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label={`Mais ações: ${rotulo}`}
          className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-superficie/70 hover:text-tinta data-[state=open]:bg-superficie/70', className)}
        >
          <EllipsisVertical className="size-4" aria-hidden />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl">
          <ItemMenu icone={<Pencil className="size-4" />} onSelect={() => acoes.editar(item)}>
            Editar
          </ItemMenu>
          {item.data !== hoje && (
            <ItemMenu icone={<ArrowRight className="size-4" />} onSelect={() => acoes.mover(item, hoje)}>
              Mover para hoje
            </ItemMenu>
          )}
          {item.data !== amanha && (
            <ItemMenu icone={<Redo2 className="size-4" />} onSelect={() => acoes.mover(item, amanha)}>
              Mover para amanhã
            </ItemMenu>
          )}
          {item.data < proxima && (
            <ItemMenu icone={<CalendarArrowUp className="size-4" />} onSelect={() => acoes.mover(item, proxima)}>
              Mover para a próxima semana
            </ItemMenu>
          )}
          <Menu.Separator className="my-1 h-px bg-linha/70" />
          <ItemMenu icone={<Trash2 className="size-4" />} onSelect={() => acoes.excluir(item)} perigo>
            Excluir
          </ItemMenu>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/** Cores do cartão: concluído (verde), atrasado (vermelho) ou a cor do tipo */
export function coresDoItem(item: ItemPlanner, hoje = hojeChave()) {
  if (concluido(item)) return { barra: 'bg-visto', fundo: 'bg-visto-fundo' }
  if (atrasado(item, hoje)) return { barra: 'bg-ruim', fundo: 'bg-ruim-fundo' }
  return COR_TIPO[item.tipo]
}

interface CartaoProps {
  item: ItemPlanner
  disciplina?: Disciplina
  topico?: Topico
  acoes: AcoesPlanner
  /** "coluna": cartão estreito da semana; "largo": linha do dia e do Início */
  variante?: 'coluna' | 'largo'
  arrastando?: boolean
  /** props do arrastar (dnd-kit), aplicadas no cartão inteiro */
  propsArrastar?: HTMLAttributes<HTMLElement>
  refCartao?: Ref<HTMLElement>
  className?: string
}

/** Cartão de um item do planner, com check, play e menu */
export function CartaoPlanner({ item, disciplina, topico, acoes, variante = 'coluna', arrastando, propsArrastar, refCartao, className }: CartaoProps) {
  const hoje = hojeChave()
  const feito = concluido(item)
  const tarde = atrasado(item, hoje)
  const cores = coresDoItem(item, hoje)
  const nomeDisciplina = disciplina?.nome ?? 'Disciplina excluída'
  const rotulo = topico ? `${nomeDisciplina}, ${topico.nome}` : nomeDisciplina
  const largo = variante === 'largo'

  const etiquetas = (
    <>
      {item.minutos_previstos !== null && (
        <span className="inline-flex items-center gap-1 numeros" title="Tempo previsto">
          <Clock className="size-3.5" aria-hidden />
          {rotuloMinutos(item.minutos_previstos)}
        </span>
      )}
      {item.adiamentos > 0 && (
        <span className="inline-flex items-center gap-1 numeros" title={`Adiado ${item.adiamentos} ${item.adiamentos === 1 ? 'vez' : 'vezes'}`}>
          <Redo2 className="size-3.5" aria-hidden />
          {largo ? `adiado ${item.adiamentos}×` : <><span className="sr-only">adiado </span>{item.adiamentos}×</>}
        </span>
      )}
    </>
  )

  const play = !feito && (
    <button
      type="button"
      onClick={() => acoes.jogar(item)}
      aria-label={`Estudar agora: ${rotulo}`}
      title="Estudar agora (abre o cronômetro)"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-superficie text-primaria-forte shadow-sm ring-1 ring-linha/70 transition-colors hover:bg-primaria hover:text-sobre-primaria dark:text-primaria dark:hover:text-sobre-primaria"
    >
      <Play className="ml-0.5 size-3.5" fill="currentColor" aria-hidden />
    </button>
  )

  return (
    <article
      ref={refCartao as Ref<HTMLElement>}
      {...propsArrastar}
      className={cn(
        'relative overflow-hidden rounded-xl pl-3.5 text-tinta',
        cores.fundo,
        largo ? 'flex items-center gap-3 py-2.5 pr-2' : 'py-2.5 pr-1.5',
        arrastando && 'opacity-40',
        propsArrastar && 'cursor-grab touch-manipulation active:cursor-grabbing',
        className,
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', cores.barra)} aria-hidden />

      {largo ? (
        <>
          <CheckPlanner feito={feito} aoClicar={() => acoes.alternar(item)} rotulo={rotulo} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold">
              <span className={cn(COR_TIPO[item.tipo].texto)}>{ROTULO_TIPO[item.tipo]}</span>
              {tarde && (
                <span className="inline-flex items-center gap-1 text-ruim">
                  <CircleAlert className="size-3.5" aria-hidden /> Atrasado
                </span>
              )}
              {feito && <span className="text-visto-texto">Feito</span>}
            </p>
            <p className={cn('truncate text-[15px] font-semibold', feito && 'text-tinta-suave line-through decoration-tinta-suave/50')}>
              {nomeDisciplina}
            </p>
            {topico && <p className={cn('line-clamp-2 text-sm text-tinta-suave', feito && 'line-through decoration-tinta-suave/50')}>{topico.nome}</p>}
            {item.observacao && <p className="line-clamp-2 text-[13px] text-tinta-suave italic">{item.observacao}</p>}
            {(item.minutos_previstos !== null || item.adiamentos > 0) && (
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-tinta-suave">{etiquetas}</p>
            )}
          </div>
          {play}
          <MenuPlanner item={item} acoes={acoes} rotulo={rotulo} />
        </>
      ) : (
        <>
          {/* linha de cima: check, tipo e menu; o texto usa a largura toda logo abaixo */}
          <div className="flex items-center gap-1.5">
            <CheckPlanner feito={feito} aoClicar={() => acoes.alternar(item)} rotulo={rotulo} className="size-5" />
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-xs font-semibold">
              <span className={cn(COR_TIPO[item.tipo].texto)}>{ROTULO_TIPO[item.tipo]}</span>
              {tarde && (
                <span className="inline-flex items-center gap-0.5 text-ruim">
                  <CircleAlert className="size-3" aria-hidden /> Atrasado
                </span>
              )}
            </p>
            <MenuPlanner item={item} acoes={acoes} rotulo={rotulo} className="-my-1" />
          </div>
          <p className={cn('mt-1.5 line-clamp-2 pr-1 text-sm leading-snug font-semibold [overflow-wrap:anywhere]', feito && 'text-tinta-suave line-through decoration-tinta-suave/50')}>
            {nomeDisciplina}
          </p>
          {topico && (
            <p className={cn('mt-0.5 line-clamp-2 pr-1 text-[13px] leading-snug [overflow-wrap:anywhere] text-tinta-suave', feito && 'line-through decoration-tinta-suave/50')}>{topico.nome}</p>
          )}
          {item.observacao && <p className="mt-1 line-clamp-3 pr-1 text-xs leading-snug [overflow-wrap:anywhere] text-tinta-suave italic">{item.observacao}</p>}
          {(play || item.minutos_previstos !== null || item.adiamentos > 0) && (
            <div className="mt-2 flex items-end justify-between gap-2 pr-1">
              <p className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-tinta-suave">{etiquetas}</p>
              {play}
            </div>
          )}
        </>
      )}
    </article>
  )
}
