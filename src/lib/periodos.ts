import { endOfWeek, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns'
import type { Estudo } from '@/types'

export interface Intervalo {
  de: Date
  ate: Date
}

/** Do dia 1 do mês até agora */
export const mesAtual = (agora = new Date()): Intervalo => ({ de: startOfMonth(agora), ate: agora })

/** O mesmo trecho do mês passado (do dia 1 até o mesmo dia e hora), para comparar de forma justa */
export function mesAnteriorMesmoTrecho(agora = new Date()): Intervalo {
  const inicioAtual = startOfMonth(agora)
  return { de: subMonths(inicioAtual, 1), ate: new Date(Math.min(subMonths(agora, 1).getTime(), inicioAtual.getTime() - 1)) }
}

/** Semana de segunda a domingo; deslocamento 0 = esta semana, 1 = a anterior… */
export function semana(deslocamento: number, agora = new Date()): Intervalo {
  const base = subWeeks(agora, deslocamento)
  return { de: startOfWeek(base, { weekStartsOn: 1 }), ate: endOfWeek(base, { weekStartsOn: 1 }) }
}

export const dentro = (iso: string, i: Intervalo) => {
  const t = new Date(iso).getTime()
  return t >= i.de.getTime() && t <= i.ate.getTime()
}

export const estudosEm = (estudos: Estudo[], i: Intervalo) => estudos.filter((e) => dentro(e.data_hora, i))

export function somarEstudos(estudos: Estudo[]) {
  let segundos = 0
  let feitas = 0
  let acertadas = 0
  for (const e of estudos) {
    segundos += e.duracao_segundos ?? 0
    feitas += e.questoes_feitas ?? 0
    acertadas += e.questoes_acertadas ?? 0
  }
  return { segundos, feitas, acertadas }
}

/** Variação percentual; null quando não há base para comparar */
export const variacaoPct = (atual: number, anterior: number) => (anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null)
