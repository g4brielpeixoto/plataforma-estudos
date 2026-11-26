import { addDays, endOfWeek, format, startOfDay, startOfWeek, subDays } from 'date-fns'
import type { Estudo } from '@/types'

/** Um dia só conta como "dia estudado" a partir deste tempo */
export const MINUTOS_PARA_CONTAR = 20

export const chaveDia = (d: Date) => format(d, 'yyyy-MM-dd')

/** Minutos estudados em cada dia (data local) */
export function minutosPorDia(estudos: Estudo[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const e of estudos) {
    if (!e.duracao_segundos) continue
    const k = chaveDia(new Date(e.data_hora))
    mapa.set(k, (mapa.get(k) ?? 0) + e.duracao_segundos / 60)
  }
  return mapa
}

export const diaConta = (minutos: number | undefined) => (minutos ?? 0) >= MINUTOS_PARA_CONTAR

/** Sábado e domingo não entram na constância (pedido dela): a sequência conta só os dias úteis */
export const diaUtil = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6

/** Dia útil anterior (pula o fim de semana) */
export function diaUtilAnterior(d: Date): Date {
  let r = subDays(startOfDay(d), 1)
  while (!diaUtil(r)) r = subDays(r, 1)
  return r
}

/** Os últimos `qtd` dias úteis terminando em `fim` (ou no dia útil antes dele), do mais antigo ao mais novo */
export function diasUteisAte(fim: Date, qtd: number): Date[] {
  let d = startOfDay(fim)
  if (!diaUtil(d)) d = diaUtilAnterior(d)
  const r: Date[] = []
  for (let i = 0; i < qtd; i++) {
    r.push(d)
    d = diaUtilAnterior(d)
  }
  return r.reverse()
}

export interface Sequencia {
  /** dias úteis seguidos até hoje (ou até o dia útil anterior, se hoje ainda não bateu os 20 min ou é fim de semana) */
  atual: number
  recorde: number
  hojeConta: boolean
  /** hoje é sábado ou domingo */
  fimDeSemana: boolean
}

export function calcularSequencia(mapa: Map<string, number>, hoje = new Date()): Sequencia {
  const fimDeSemana = !diaUtil(hoje)
  const hojeConta = !fimDeSemana && diaConta(mapa.get(chaveDia(hoje)))
  // a sequência continua viva enquanto o dia de hoje não terminou; fim de semana não quebra
  let dia = hojeConta ? startOfDay(hoje) : diaUtilAnterior(hoje)
  let atual = 0
  while (diaConta(mapa.get(chaveDia(dia)))) {
    atual++
    dia = diaUtilAnterior(dia)
  }

  const dias = [...mapa.entries()]
    .filter(([k, m]) => diaConta(m) && diaUtil(new Date(`${k}T12:00:00`)))
    .map(([k]) => k)
    .sort()
  let recorde = 0
  let corrida = 0
  let anterior: string | null = null
  for (const k of dias) {
    const seguido = anterior !== null && chaveDia(diaUtilAnterior(new Date(`${k}T12:00:00`))) === anterior
    corrida = seguido ? corrida + 1 : 1
    recorde = Math.max(recorde, corrida)
    anterior = k
  }
  return { atual, recorde: Math.max(recorde, atual), hojeConta, fimDeSemana }
}

/** Faixas de intensidade do mapa de calor */
export function nivelCalor(minutos: number | undefined): 0 | 1 | 2 | 3 | 4 {
  const m = minutos ?? 0
  if (m < MINUTOS_PARA_CONTAR) return 0
  if (m < 60) return 1
  if (m < 120) return 2
  if (m < 240) return 3
  return 4
}

export const ROTULOS_CALOR = ['Menos de 20 min', '20 a 59 min', '1h a 1h59', '2h a 3h59', '4h ou mais']

/** Semanas (colunas de domingo a sábado) dos últimos 12 meses, terminando na semana atual */
export function semanasDoAno(hoje = new Date()): (Date | null)[][] {
  const inicio = startOfWeek(subDays(startOfDay(hoje), 364), { weekStartsOn: 0 })
  const fim = endOfWeek(hoje, { weekStartsOn: 0 })
  const semanas: (Date | null)[][] = []
  for (let d = inicio; d <= fim; d = addDays(d, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => {
      const dia = addDays(d, i)
      return dia > hoje ? null : dia
    }))
  }
  return semanas
}

/** Segunda a domingo da semana atual */
export function semanaAtual(hoje = new Date()) {
  return { de: startOfWeek(hoje, { weekStartsOn: 1 }), ate: endOfWeek(hoje, { weekStartsOn: 1 }) }
}
