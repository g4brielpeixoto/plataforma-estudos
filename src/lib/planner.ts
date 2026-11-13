import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import type { ItemPlanner, TipoPlanner } from '@/types'

/*
  Regras do planner.
  As datas dos itens são "date" do Postgres (yyyy-mm-dd, sem fuso): compare sempre como texto,
  e converta para Date só com paraData(), que monta a data no fuso do aparelho.
*/

export type Visao = 'dia' | 'semana' | 'mes'

export const TIPOS: { valor: TipoPlanner; rotulo: string }[] = [
  { valor: 'estudo', rotulo: 'Estudo' },
  { valor: 'resumo', rotulo: 'Resumo' },
  { valor: 'exercicios', rotulo: 'Exercícios' },
]

export const ROTULO_TIPO: Record<TipoPlanner, string> = { estudo: 'Estudo', resumo: 'Resumo', exercicios: 'Exercícios' }

/** Classes de cor de cada tipo (tokens --c-<tipo> e --c-<tipo>-fundo em index.css) */
export const COR_TIPO: Record<TipoPlanner, { barra: string; fundo: string; texto: string }> = {
  estudo: { barra: 'bg-estudo', fundo: 'bg-estudo-fundo', texto: 'text-estudo' },
  resumo: { barra: 'bg-resumo', fundo: 'bg-resumo-fundo', texto: 'text-resumo' },
  exercicios: { barra: 'bg-exercicios', fundo: 'bg-exercicios-fundo', texto: 'text-exercicios' },
}

/** Date → "2026-11-10" (dia do aparelho) */
export const chaveData = (d: Date) => format(d, 'yyyy-MM-dd')

/** "2026-11-10" → Date à meia-noite local */
export function paraData(chave: string): Date {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const hojeChave = (agora = new Date()) => chaveData(agora)
export const amanhaChave = (agora = new Date()) => chaveData(addDays(agora, 1))
/** Segunda-feira da próxima semana */
export const proximaSemanaChave = (agora = new Date()) => chaveData(startOfWeek(addWeeks(agora, 1), { weekStartsOn: 1 }))

export const concluido = (i: Pick<ItemPlanner, 'concluido_em'>) => i.concluido_em !== null

/** Pendente e com a data já passada */
export const atrasado = (i: Pick<ItemPlanner, 'concluido_em' | 'data'>, hoje = hojeChave()) => !concluido(i) && i.data < hoje

/** Itens atrasados, do mais antigo para o mais novo */
export function itensAtrasados(itens: ItemPlanner[], hoje = hojeChave()) {
  return itens.filter((i) => atrasado(i, hoje)).sort(ordenarItens)
}

export function ordenarItens(a: ItemPlanner, b: ItemPlanner) {
  return a.data.localeCompare(b.data) || a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em)
}

/** Itens agrupados por dia (já ordenados) */
export function porDia(itens: ItemPlanner[]) {
  const mapa = new Map<string, ItemPlanner[]>()
  for (const i of [...itens].sort(ordenarItens)) {
    const lista = mapa.get(i.data)
    if (lista) lista.push(i)
    else mapa.set(i.data, [i])
  }
  return mapa
}

/** Próxima posição livre no fim do dia */
export function proximaOrdem(itens: ItemPlanner[], data: string) {
  let maior = -1
  for (const i of itens) if (i.data === data && i.ordem > maior) maior = i.ordem
  return maior + 1
}

/**
  Leva o item para outro dia, no fim da lista daquele dia.
  Conta como adiamento quando um item pendente sai de hoje ou de um dia que já passou para um dia mais à frente
  (reorganizar o que ainda está no futuro não conta).
*/
export function moverItem(item: ItemPlanner, novaData: string, todos: ItemPlanner[], hoje = hojeChave()): ItemPlanner {
  if (novaData === item.data) return item
  const adiou = !concluido(item) && item.data <= hoje && novaData > item.data
  return { ...item, data: novaData, ordem: proximaOrdem(todos, novaData), adiamentos: item.adiamentos + (adiou ? 1 : 0) }
}

/**
  Reagenda vários itens de uma vez: a partir de `inicio`, `porDiaMax` itens por dia, na ordem em que estavam.
  Cada item entra no fim do dia de destino.
*/
export function reagendar(itens: ItemPlanner[], inicio: string, porDiaMax: number, todos: ItemPlanner[], hoje = hojeChave()): ItemPlanner[] {
  const n = Math.max(1, Math.floor(porDiaMax))
  const base = paraData(inicio)
  const ordens = new Map<string, number>()
  return [...itens].sort(ordenarItens).map((item, idx) => {
    const data = chaveData(addDays(base, Math.floor(idx / n)))
    const ordem = ordens.get(data) ?? proximaOrdem(todos, data)
    ordens.set(data, ordem + 1)
    const adiou = !concluido(item) && item.data <= hoje && data > item.data
    return { ...item, data, ordem, adiamentos: item.adiamentos + (adiou ? 1 : 0) }
  })
}

/** Os 7 dias (segunda a domingo) da semana que contém `ref` */
export function diasDaSemana(ref: Date) {
  const inicio = startOfWeek(ref, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i))
}

/** Semanas completas (segunda a domingo) que cobrem o mês de `ref` */
export function semanasDoMes(ref: Date) {
  const inicio = startOfWeek(startOfMonth(ref), { weekStartsOn: 1 })
  const fim = endOfWeek(endOfMonth(ref), { weekStartsOn: 1 })
  const semanas: Date[][] = []
  for (let d = inicio; d <= fim; d = addDays(d, 7)) semanas.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
  return semanas
}

/** Avança ou volta uma unidade da visão (dia, semana ou mês) */
export function deslocar(ref: Date, visao: Visao, passo: number) {
  if (visao === 'dia') return addDays(ref, passo)
  if (visao === 'semana') return addWeeks(ref, passo)
  return addMonths(ref, passo)
}

/** O período mostrado contém hoje? */
export function contemHoje(ref: Date, visao: Visao, agora = new Date()) {
  if (visao === 'dia') return chaveData(ref) === chaveData(agora)
  if (visao === 'semana') return chaveData(startOfWeek(ref, { weekStartsOn: 1 })) === chaveData(startOfWeek(agora, { weekStartsOn: 1 }))
  return format(ref, 'yyyy-MM') === format(agora, 'yyyy-MM')
}

/** "1h30" para minutos previstos */
export function rotuloMinutos(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Soma dos minutos previstos e quantos foram cumpridos */
export function resumoItens(itens: ItemPlanner[]) {
  let minutos = 0
  let feitos = 0
  for (const i of itens) {
    minutos += i.minutos_previstos ?? 0
    if (concluido(i)) feitos++
  }
  return { total: itens.length, feitos, minutos }
}
