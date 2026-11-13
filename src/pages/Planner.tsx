import { DndContext, DragOverlay, MouseSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { format, isSameMonth, isSameYear, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Plus, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { CartaoPlanner, CheckPlanner, coresDoItem, MenuPlanner } from '@/components/CartaoPlanner'
import { Botao, CabecalhoPagina, Carregando, Dialogo, Painel } from '@/components/ui'
import { useDisciplinas, usePlanner, useTopicos } from '@/hooks/dados'
import { nomeDoDia, usePlannerAcoes, type AcoesPlanner } from '@/hooks/usePlannerAcoes'
import {
  amanhaChave,
  chaveData,
  concluido,
  contemHoje,
  COR_TIPO,
  deslocar,
  diasDaSemana,
  hojeChave,
  itensAtrasados,
  porDia,
  proximaSemanaChave,
  reagendar,
  resumoItens,
  ROTULO_TIPO,
  rotuloMinutos,
  semanasDoMes,
  TIPOS,
  type Visao,
} from '@/lib/planner'
import { cn } from '@/lib/utils'
import type { Disciplina, ItemPlanner, Topico } from '@/types'

const CHAVE_VISAO = 'planner:visao'

function lerVisao(): Visao {
  try {
    const v = localStorage.getItem(CHAVE_VISAO)
    return v === 'dia' || v === 'mes' ? v : 'semana'
  } catch {
    return 'semana'
  }
}

interface Mapas {
  disciplinas: Map<string, Disciplina>
  topicos: Map<string, Topico>
}

/** "9 a 15 de novembro", "30 de nov. a 6 de dez." (com o ano quando não é o atual) */
function rotuloSemana(ref: Date) {
  const dias = diasDaSemana(ref)
  const de = dias[0]
  const ate = dias[6]
  const ano = isSameYear(ate, new Date()) ? '' : ` de ${format(ate, 'yyyy')}`
  if (isSameMonth(de, ate)) return `${format(de, 'd')} a ${format(ate, "d 'de' MMMM", { locale: ptBR })}${ano}`
  return `${format(de, "d 'de' MMM", { locale: ptBR })} a ${format(ate, "d 'de' MMM", { locale: ptBR })}${ano}`
}

function textoResumo(itens: ItemPlanner[]) {
  const r = resumoItens(itens)
  if (!r.total) return 'Nada planejado ainda'
  return `${r.feitos} de ${r.total} ${r.total === 1 ? 'feito' : 'feitos'}${r.minutos ? ` · ${rotuloMinutos(r.minutos)} previstas` : ''}`
}

export function Planner() {
  const planner = usePlanner()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const acoes = usePlannerAcoes()
  const [visao, setVisao] = useState<Visao>(lerVisao)
  const [ref, setRef] = useState(() => new Date())
  const [reagendando, setReagendando] = useState(false)

  const hoje = hojeChave()
  const itens = useMemo(() => planner.data ?? [], [planner.data])
  const grupos = useMemo(() => porDia(itens), [itens])
  const atrasados = useMemo(() => itensAtrasados(itens, hoje), [itens, hoje])
  const mapas: Mapas = useMemo(
    () => ({
      disciplinas: new Map((disciplinas.data ?? []).map((d) => [d.id, d])),
      topicos: new Map((topicos.data ?? []).map((t) => [t.id, t])),
    }),
    [disciplinas.data, topicos.data],
  )

  const trocarVisao = (v: Visao) => {
    setVisao(v)
    try {
      localStorage.setItem(CHAVE_VISAO, v)
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }
  const abrirDia = (dia: Date) => {
    setRef(dia)
    trocarVisao('dia')
  }

  // período mostrado
  const titulo =
    visao === 'dia' ? format(ref, "EEEE, d 'de' MMMM", { locale: ptBR }) : visao === 'semana' ? rotuloSemana(ref) : format(ref, "MMMM 'de' yyyy", { locale: ptBR })
  const doPeriodo = useMemo(() => {
    if (visao === 'dia') return grupos.get(chaveData(ref)) ?? []
    if (visao === 'semana') return diasDaSemana(ref).flatMap((d) => grupos.get(chaveData(d)) ?? [])
    const mes = format(ref, 'yyyy-MM')
    return itens.filter((i) => i.data.startsWith(mes))
  }, [visao, ref, grupos, itens])
  const atual = contemHoje(ref, visao)
  const rotuloAtual = visao === 'dia' ? 'Hoje' : visao === 'semana' ? 'Semana atual' : 'Mês atual'
  const nomeUnidade = visao === 'dia' ? 'dia' : visao === 'semana' ? 'semana' : 'mês'

  // dia sugerido ao planejar: o dia aberto; ou hoje, se estiver no período; ou o primeiro dia do período
  const dataPadrao =
    visao === 'dia' ? chaveData(ref) : atual ? hoje : chaveData(visao === 'semana' ? startOfWeek(ref, { weekStartsOn: 1 }) : startOfMonth(ref))

  const carregando = planner.isLoading || disciplinas.isLoading || topicos.isLoading

  return (
    <>
      <CabecalhoPagina
        titulo="Planner"
        subtitulo="Planeje o que estudar em cada dia e marque o que cumpriu."
        acoes={
          <Botao onClick={() => acoes.novo(dataPadrao)}>
            <Plus className="size-4" aria-hidden /> Planejar estudo
          </Botao>
        }
      />

      {carregando ? (
        <Carregando />
      ) : (
        <>
          {atrasados.length > 0 && <PainelAtrasados atrasados={atrasados} mapas={mapas} acoes={acoes} aoReagendarTodos={() => setReagendando(true)} />}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <button
                onClick={() => setRef((r) => deslocar(r, visao, -1))}
                aria-label={`${nomeUnidade === 'semana' ? 'Semana anterior' : nomeUnidade === 'mês' ? 'Mês anterior' : 'Dia anterior'}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                onClick={() => setRef((r) => deslocar(r, visao, 1))}
                aria-label={`${nomeUnidade === 'semana' ? 'Próxima semana' : nomeUnidade === 'mês' ? 'Próximo mês' : 'Próximo dia'}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
              <div className="ml-1.5 min-w-0">
                <h2 className="text-xl leading-tight font-medium text-tinta first-letter:uppercase" aria-live="polite">
                  {titulo}
                </h2>
                <p className="text-sm text-tinta-suave numeros">{textoResumo(doPeriodo)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Botao variante="secundario" tamanho="sm" onClick={() => setRef(new Date())} disabled={atual}>
                {rotuloAtual}
              </Botao>
              <div role="tablist" aria-label="Visualização" className="inline-flex rounded-xl bg-superficie-2 p-1">
                {(
                  [
                    ['dia', 'Dia'],
                    ['semana', 'Semana'],
                    ['mes', 'Mês'],
                  ] as [Visao, string][]
                ).map(([v, r]) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={visao === v}
                    onClick={() => trocarVisao(v)}
                    className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', visao === v ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Legenda />

          {visao === 'semana' && <VisaoSemana referencia={ref} grupos={grupos} mapas={mapas} acoes={acoes} />}
          {visao === 'dia' && <VisaoDia dia={ref} itens={grupos.get(chaveData(ref)) ?? []} mapas={mapas} acoes={acoes} />}
          {visao === 'mes' && <VisaoMes referencia={ref} grupos={grupos} mapas={mapas} aoEscolherDia={abrirDia} />}
        </>
      )}

      <ReagendarDialog aberto={reagendando} aoMudar={setReagendando} itens={atrasados} aoConfirmar={(inicio, n) => acoes.reagendar(atrasados, inicio, n)} />
      {acoes.dialogos}
    </>
  )
}

function Legenda() {
  return (
    <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tinta-suave" aria-label="Legenda">
      {TIPOS.map((t) => (
        <li key={t.valor} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded-[4px]', COR_TIPO[t.valor].barra)} aria-hidden />
          {t.rotulo}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="grid size-3.5 place-items-center rounded-full bg-visto text-superficie" aria-hidden>
          <Check className="size-2.5" strokeWidth={3.5} />
        </span>
        Feito
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] bg-ruim" aria-hidden />
        Atrasado
      </li>
    </ul>
  )
}

// ---------- semana ----------

function VisaoSemana({ referencia, grupos, mapas, acoes }: { referencia: Date; grupos: Map<string, ItemPlanner[]>; mapas: Mapas; acoes: AcoesPlanner }) {
  const dias = diasDaSemana(referencia)
  const hoje = hojeChave()
  const [arrastado, setArrastado] = useState<ItemPlanner | null>(null)
  const trilho = useRef<HTMLDivElement>(null)
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // no toque, segurar um instante para arrastar; deslizar continua rolando a tela
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  const inicioSemana = chaveData(dias[0])

  // em telas estreitas (rolagem lateral), começa mostrando o dia de hoje
  useEffect(() => {
    const el = trilho.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    const coluna = el.querySelector<HTMLElement>('[data-hoje="true"]')
    el.scrollLeft = coluna ? coluna.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft) : 0
  }, [inicioSemana])

  const aoSoltar = (e: DragEndEvent) => {
    setArrastado(null)
    const destino = e.over?.id
    const item = e.active.data.current?.item as ItemPlanner | undefined
    if (typeof destino === 'string' && item && destino !== item.data) acoes.mover(item, destino)
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setArrastado((e.active.data.current?.item as ItemPlanner) ?? null)}
      onDragEnd={aoSoltar}
      onDragCancel={() => setArrastado(null)}
    >
      <div
        ref={trilho}
        className={cn(
          'relative -mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0 xl:grid xl:grid-cols-7 xl:overflow-visible xl:pb-0',
          !arrastado && 'snap-x snap-mandatory',
        )}
      >
        {dias.map((dia) => {
          const chave = chaveData(dia)
          return <ColunaDia key={chave} dia={dia} ehHoje={chave === hoje} itens={grupos.get(chave) ?? []} mapas={mapas} acoes={acoes} />
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {arrastado && (
          <CartaoPlanner
            item={arrastado}
            disciplina={mapas.disciplinas.get(arrastado.disciplina_id)}
            topico={arrastado.topico_id ? mapas.topicos.get(arrastado.topico_id) : undefined}
            acoes={acoes}
            className="rotate-1 cursor-grabbing shadow-xl ring-1 ring-linha"
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

function ColunaDia({ dia, ehHoje, itens, mapas, acoes }: { dia: Date; ehHoje: boolean; itens: ItemPlanner[]; mapas: Mapas; acoes: AcoesPlanner }) {
  const chave = chaveData(dia)
  const { setNodeRef, isOver } = useDroppable({ id: chave })
  const r = resumoItens(itens)
  const passado = chave < hojeChave()
  const nome = format(dia, 'EEEE', { locale: ptBR }).split('-')[0]

  return (
    <section
      ref={setNodeRef}
      data-hoje={ehHoje}
      aria-label={`${format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}${ehHoje ? ' (hoje)' : ''}`}
      className={cn(
        'flex w-[80%] min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-superficie transition-shadow sm:w-[46%] md:w-[31%] lg:w-[30%] xl:w-auto',
        isOver ? 'border-primaria ring-2 ring-primaria/30' : 'border-linha/70',
      )}
    >
      <header className={cn('px-3 py-2.5', ehHoje ? 'bg-primaria-forte text-sobre-primaria' : 'bg-cabecalho text-sobre-cabecalho')}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold capitalize">{nome}</span>
          <span className="text-sm numeros opacity-90">{format(dia, 'dd/MM')}</span>
        </div>
        <p className="mt-0.5 truncate text-xs numeros opacity-80">
          {ehHoje ? 'Hoje · ' : ''}
          {r.total ? `${r.feitos}/${r.total} ${r.total === 1 ? 'feito' : 'feitos'}${r.minutos ? ` · ${rotuloMinutos(r.minutos)}` : ''}` : 'Livre'}
        </p>
      </header>
      <div className={cn('flex min-h-48 flex-1 flex-col gap-2 p-2 transition-colors', isOver ? 'bg-nevoa/40' : passado && 'bg-superficie-2/50')}>
        {itens.map((i) => (
          <CartaoArrastavel
            key={i.id}
            item={i}
            disciplina={mapas.disciplinas.get(i.disciplina_id)}
            topico={i.topico_id ? mapas.topicos.get(i.topico_id) : undefined}
            acoes={acoes}
          />
        ))}
        <button
          type="button"
          onClick={() => acoes.novo(chave)}
          aria-label={`Adicionar em ${format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}`}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-linha py-2 text-sm text-tinta-suave transition-colors hover:border-lilas hover:bg-nevoa/30 hover:text-tinta"
        >
          <Plus className="size-4" aria-hidden /> Adicionar
        </button>
      </div>
    </section>
  )
}

function CartaoArrastavel(props: { item: ItemPlanner; disciplina?: Disciplina; topico?: Topico; acoes: AcoesPlanner }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: props.item.id, data: { item: props.item } })
  return <CartaoPlanner {...props} refCartao={setNodeRef} propsArrastar={listeners as HTMLAttributes<HTMLElement>} arrastando={isDragging} />
}

// ---------- dia ----------

function VisaoDia({ dia, itens, mapas, acoes }: { dia: Date; itens: ItemPlanner[]; mapas: Mapas; acoes: AcoesPlanner }) {
  const chave = chaveData(dia)
  return (
    <Painel className="p-3 sm:p-4">
      {itens.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <p className="font-semibold text-tinta">Nada planejado para {nomeDoDia(chave) === 'hoje' ? 'hoje' : 'este dia'}.</p>
          <p className="mt-1 max-w-sm text-sm text-tinta-suave">Escolha uma disciplina, o tipo de atividade e quanto tempo pretende dedicar.</p>
          <Botao className="mt-5" onClick={() => acoes.novo(chave)}>
            <Plus className="size-4" aria-hidden /> Planejar estudo
          </Botao>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {itens.map((i) => (
              <li key={i.id}>
                <CartaoPlanner
                  item={i}
                  variante="largo"
                  disciplina={mapas.disciplinas.get(i.disciplina_id)}
                  topico={i.topico_id ? mapas.topicos.get(i.topico_id) : undefined}
                  acoes={acoes}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => acoes.novo(chave)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-linha py-2.5 text-sm text-tinta-suave transition-colors hover:border-lilas hover:bg-nevoa/30 hover:text-tinta"
          >
            <Plus className="size-4" aria-hidden /> Adicionar neste dia
          </button>
        </>
      )}
    </Painel>
  )
}

// ---------- mês ----------

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function VisaoMes({ referencia, grupos, mapas, aoEscolherDia }: { referencia: Date; grupos: Map<string, ItemPlanner[]>; mapas: Mapas; aoEscolherDia: (d: Date) => void }) {
  const hoje = hojeChave()
  const dias = semanasDoMes(referencia).flat()
  return (
    <div className="overflow-hidden rounded-2xl border border-linha/70 bg-superficie">
      <div className="grid grid-cols-7 bg-cabecalho text-sobre-cabecalho" aria-hidden>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="px-1 py-2 text-center text-xs font-semibold sm:px-3 sm:text-left sm:text-sm">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia, idx) => {
          const chave = chaveData(dia)
          const lista = grupos.get(chave) ?? []
          const fora = !isSameMonth(dia, referencia)
          const ehHoje = chave === hoje
          const r = resumoItens(lista)
          return (
            <button
              key={chave}
              type="button"
              onClick={() => aoEscolherDia(dia)}
              aria-label={`${format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${r.total ? `${r.feitos} de ${r.total} feitos` : 'nada planejado'}. Abrir o dia.`}
              className={cn(
                'flex min-h-16 min-w-0 flex-col items-stretch gap-1 border-linha/60 p-1 text-left transition-colors hover:bg-nevoa/30 sm:min-h-28 sm:p-1.5',
                idx % 7 !== 0 && 'border-l',
                idx >= 7 && 'border-t',
                fora && 'bg-superficie-2/60',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center self-center rounded-full text-xs font-semibold numeros sm:size-7 sm:self-start sm:text-sm',
                  ehHoje ? 'bg-primaria-forte text-sobre-primaria' : fora ? 'text-tinta-suave/60' : 'text-tinta',
                )}
              >
                {dia.getDate()}
              </span>
              {/* celular: bolinhas coloridas */}
              {lista.length > 0 && (
                <span className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                  {lista.slice(0, 6).map((i) => (
                    <span key={i.id} className={cn('size-1.5 rounded-full', coresDoItem(i, hoje).barra)} />
                  ))}
                </span>
              )}
              {/* telas maiores: o nome da disciplina */}
              <span className="hidden min-w-0 flex-col gap-1 sm:flex" aria-hidden>
                {lista.slice(0, 3).map((i) => {
                  const cores = coresDoItem(i, hoje)
                  const feito = concluido(i)
                  return (
                    <span key={i.id} className={cn('flex min-w-0 items-center gap-1 rounded-md py-0.5 pr-1.5 pl-1 text-xs text-tinta', cores.fundo)}>
                      <span className={cn('h-3 w-1 shrink-0 rounded-full', cores.barra)} />
                      {feito && <Check className="size-3 shrink-0 text-visto" strokeWidth={3} />}
                      <span className={cn('truncate', feito && 'text-tinta-suave line-through')}>{mapas.disciplinas.get(i.disciplina_id)?.nome ?? 'Disciplina excluída'}</span>
                    </span>
                  )
                })}
                {lista.length > 3 && <span className="px-1 text-xs text-tinta-suave">+{lista.length - 3} mais</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- atrasados ----------

function BotaoMover({ children, onClick, title }: { children: ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-8 rounded-lg bg-superficie px-2.5 text-sm font-medium whitespace-nowrap text-tinta ring-1 ring-linha transition-colors hover:bg-nevoa/60"
    >
      {children}
    </button>
  )
}

function PainelAtrasados({ atrasados, mapas, acoes, aoReagendarTodos }: { atrasados: ItemPlanner[]; mapas: Mapas; acoes: AcoesPlanner; aoReagendarTodos: () => void }) {
  const [todos, setTodos] = useState(false)
  const n = atrasados.length
  const visiveis = todos ? atrasados : atrasados.slice(0, 4)
  const hoje = hojeChave()
  const amanha = amanhaChave()
  const proxima = proximaSemanaChave()

  return (
    <section aria-labelledby="titulo-atrasados" className="mb-6 rounded-2xl border border-ruim/25 bg-ruim-fundo/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-ruim" aria-hidden />
          <div className="min-w-0">
            <h2 id="titulo-atrasados" className="font-semibold text-tinta">
              {n} {n === 1 ? 'item atrasado' : 'itens atrasados'}
            </h2>
            <p className="text-sm text-tinta-suave">Escolha quando fazer cada um, ou marque o que já fez.</p>
          </div>
        </div>
        {n > 1 && (
          <Botao variante="secundario" tamanho="sm" onClick={aoReagendarTodos}>
            <CalendarClock className="size-4" aria-hidden /> Reagendar todos
          </Botao>
        )}
      </div>
      <ul className="mt-3 divide-y divide-ruim/15">
        {visiveis.map((i) => {
          const disciplina = mapas.disciplinas.get(i.disciplina_id)?.nome ?? 'Disciplina excluída'
          const topico = i.topico_id ? mapas.topicos.get(i.topico_id)?.nome : undefined
          const rotulo = topico ? `${disciplina}, ${topico}` : disciplina
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
                <CheckPlanner feito={false} aoClicar={() => acoes.alternar(i)} rotulo={rotulo} />
                <span className={cn('h-9 w-1 shrink-0 rounded-full', COR_TIPO[i.tipo].barra)} aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-tinta">
                    {disciplina}
                    {topico && <span className="font-normal text-tinta-suave"> · {topico}</span>}
                  </p>
                  <p className="text-xs text-tinta-suave">
                    {ROTULO_TIPO[i.tipo]} · era para {nomeDoDia(i.data)}
                    {i.adiamentos > 0 && ` · adiado ${i.adiamentos}×`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-9 sm:pl-0">
                <span className="sr-only">Mover {rotulo} para:</span>
                <BotaoMover onClick={() => acoes.mover(i, hoje)}>Hoje</BotaoMover>
                <BotaoMover onClick={() => acoes.mover(i, amanha)}>Amanhã</BotaoMover>
                <BotaoMover onClick={() => acoes.mover(i, proxima)} title={`Segunda, ${nomeDoDia(proxima)}`}>
                  Próx. semana
                </BotaoMover>
                <MenuPlanner item={i} acoes={acoes} rotulo={rotulo} />
              </div>
            </li>
          )
        })}
      </ul>
      {n > 4 && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-1 text-sm font-medium text-ruim underline-offset-2 hover:underline">
          {todos ? 'Mostrar menos' : `Ver todos (${n})`}
        </button>
      )}
    </section>
  )
}

function ReagendarDialog({
  aberto,
  aoMudar,
  itens,
  aoConfirmar,
}: {
  aberto: boolean
  aoMudar: (a: boolean) => void
  itens: ItemPlanner[]
  aoConfirmar: (inicio: string, porDia: number) => void
}) {
  const [comeco, setComeco] = useState<'hoje' | 'amanha'>('hoje')
  const [porDiaMax, setPorDiaMax] = useState(2)
  const n = itens.length
  const inicio = comeco === 'hoje' ? hojeChave() : amanhaChave()

  const previa = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const i of reagendar(itens, inicio, porDiaMax, [])) contagem.set(i.data, (contagem.get(i.data) ?? 0) + 1)
    return [...contagem.entries()]
  }, [itens, inicio, porDiaMax])

  const opcoes = [1, 2, 3, 4, 5].filter((x) => x < n)

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo="Reagendar atrasados"
      descricao={`Os ${n} itens são distribuídos a partir do dia escolhido, na ordem em que foram planejados.`}
      largura="max-w-md"
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-tinta">Começar</legend>
          <div className="inline-flex rounded-xl bg-superficie-2 p-1">
            {(
              [
                ['hoje', 'Hoje'],
                ['amanha', 'Amanhã'],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                aria-pressed={comeco === v}
                onClick={() => setComeco(v)}
                className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors', comeco === v ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta')}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-tinta">Quantos por dia</legend>
          <div className="flex flex-wrap gap-1.5">
            {[...opcoes, n].map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={porDiaMax === x || (x === n && porDiaMax >= n)}
                onClick={() => setPorDiaMax(x)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium numeros transition-colors',
                  porDiaMax === x || (x === n && porDiaMax >= n) ? 'bg-primaria text-sobre-primaria' : 'bg-superficie-2 text-tinta-suave hover:text-tinta',
                )}
              >
                {x === n ? 'Todos no mesmo dia' : x}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="rounded-xl bg-superficie-2/70 px-4 py-3">
          <p className="text-sm font-medium text-tinta">Como fica</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-tinta-suave numeros">
            {previa.map(([data, q]) => (
              <li key={data} className="flex justify-between gap-4">
                <span className="first-letter:uppercase">{nomeDoDia(data)}</span>
                <span>
                  {q} {q === 1 ? 'item' : 'itens'}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao
            type="button"
            onClick={() => {
              aoConfirmar(inicio, porDiaMax)
              aoMudar(false)
            }}
          >
            Reagendar {n} {n === 1 ? 'item' : 'itens'}
          </Botao>
        </div>
      </div>
    </Dialogo>
  )
}
