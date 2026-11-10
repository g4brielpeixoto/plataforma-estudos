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

export interface Sequencia {
  /** dias seguidos até hoje (ou até ontem, se hoje ainda não bateu os 20 min) */
  atual: number
  recorde: number
  hojeConta: boolean
}

export function calcularSequencia(mapa: Map<string, number>, hoje = new Date()): Sequencia {
  const hojeConta = diaConta(mapa.get(chaveDia(hoje)))
  // a sequência continua viva enquanto o dia de hoje não terminou
  let dia = hojeConta ? startOfDay(hoje) : subDays(startOfDay(hoje), 1)
  let atual = 0
  while (diaConta(mapa.get(chaveDia(dia)))) {
    atual++
    dia = subDays(dia, 1)
  }

  const dias = [...mapa.entries()].filter(([, m]) => diaConta(m)).map(([k]) => k).sort()
  let recorde = 0
  let corrida = 0
  let anterior: string | null = null
  for (const k of dias) {
    const esperado = anterior ? chaveDia(addDays(new Date(`${anterior}T12:00:00`), 1)) : null
    corrida = k === esperado ? corrida + 1 : 1
    recorde = Math.max(recorde, corrida)
    anterior = k
  }
  return { atual, recorde: Math.max(recorde, atual), hojeConta }
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
