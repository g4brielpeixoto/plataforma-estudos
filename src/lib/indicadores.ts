import { endOfDay, startOfDay, subDays } from 'date-fns'
import type { Estudo, Topico } from '@/types'
import { porcentagem } from './utils'

export type PeriodoPreset = 'hoje' | '7d' | '30d' | 'tudo' | 'personalizado'

export interface Periodo {
  preset: PeriodoPreset
  /** yyyy-mm-dd, usados só no personalizado */
  inicio?: string
  fim?: string
}

export const ROTULOS_PERIODO: Record<PeriodoPreset, string> = {
  hoje: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  tudo: 'Tudo',
  personalizado: 'Datas',
}

/** Intervalo [de, ate] do período; null em "tudo" */
export function intervaloDoPeriodo(p: Periodo, agora = new Date()): { de: Date; ate: Date } | null {
  switch (p.preset) {
    case 'hoje':
      return { de: startOfDay(agora), ate: endOfDay(agora) }
    case '7d':
      return { de: startOfDay(subDays(agora, 6)), ate: endOfDay(agora) }
    case '30d':
      return { de: startOfDay(subDays(agora, 29)), ate: endOfDay(agora) }
    case 'personalizado': {
      if (!p.inicio && !p.fim) return null
      const de = p.inicio ? startOfDay(new Date(`${p.inicio}T00:00:00`)) : new Date(0)
      const ate = p.fim ? endOfDay(new Date(`${p.fim}T00:00:00`)) : endOfDay(agora)
      return { de, ate }
    }
    default:
      return null
  }
}

export function filtrarPorPeriodo(estudos: Estudo[], p: Periodo): Estudo[] {
  const intervalo = intervaloDoPeriodo(p)
  if (!intervalo) return estudos
  const de = intervalo.de.getTime()
  const ate = intervalo.ate.getTime()
  return estudos.filter((e) => {
    const t = new Date(e.data_hora).getTime()
    return t >= de && t <= ate
  })
}

export interface Indicadores {
  tempoSegundos: number
  questoesFeitas: number
  questoesAcertadas: number
  questoesErradas: number
  acertoPct: number | null
  topicosTotal: number
  topicosConcluidos: number
  topicosPendentes: number
  progressoPct: number | null
  sessoes: number
}

/**
 * Tempo e desempenho vêm dos estudos (já filtrados pelo período).
 * Progresso no edital vem dos tópicos marcados como concluídos (não depende do período).
 */
export function calcularIndicadores(estudos: Estudo[], topicos: Topico[]): Indicadores {
  let tempo = 0
  let feitas = 0
  let acertadas = 0
  for (const e of estudos) {
    tempo += e.duracao_segundos ?? 0
    feitas += e.questoes_feitas ?? 0
    acertadas += e.questoes_acertadas ?? 0
  }
  const concluidos = topicos.filter((t) => t.concluido).length
  return {
    tempoSegundos: tempo,
    questoesFeitas: feitas,
    questoesAcertadas: acertadas,
    questoesErradas: feitas - acertadas,
    acertoPct: porcentagem(acertadas, feitas),
    topicosTotal: topicos.length,
    topicosConcluidos: concluidos,
    topicosPendentes: topicos.length - concluidos,
    progressoPct: porcentagem(concluidos, topicos.length),
    sessoes: estudos.length,
  }
}

export interface ResumoTopico {
  tempoSegundos: number
  questoesFeitas: number
  questoesAcertadas: number
  acertoPct: number | null
  ultimoEstudo: string | null
  sessoes: number
}

/** Agrega os estudos por tópico (os estudos sem tópico ficam de fora) */
export function resumirPorTopico(estudos: Estudo[]): Map<string, ResumoTopico> {
  const mapa = new Map<string, ResumoTopico>()
  for (const e of estudos) {
    if (!e.topico_id) continue
    const r = mapa.get(e.topico_id) ?? {
      tempoSegundos: 0,
      questoesFeitas: 0,
      questoesAcertadas: 0,
      acertoPct: null,
      ultimoEstudo: null,
      sessoes: 0,
    }
    r.tempoSegundos += e.duracao_segundos ?? 0
    r.questoesFeitas += e.questoes_feitas ?? 0
    r.questoesAcertadas += e.questoes_acertadas ?? 0
    r.sessoes += 1
    if (!r.ultimoEstudo || e.data_hora > r.ultimoEstudo) r.ultimoEstudo = e.data_hora
    mapa.set(e.topico_id, r)
  }
  for (const r of mapa.values()) r.acertoPct = porcentagem(r.questoesAcertadas, r.questoesFeitas)
  return mapa
}

/** Soma os resumos de vários tópicos (ex.: um tópico e os seus subtópicos) */
export function somarResumos(lista: (ResumoTopico | undefined)[]): ResumoTopico | undefined {
  const validos = lista.filter((r): r is ResumoTopico => !!r)
  if (!validos.length) return undefined
  const total: ResumoTopico = { tempoSegundos: 0, questoesFeitas: 0, questoesAcertadas: 0, acertoPct: null, ultimoEstudo: null, sessoes: 0 }
  for (const r of validos) {
    total.tempoSegundos += r.tempoSegundos
    total.questoesFeitas += r.questoesFeitas
    total.questoesAcertadas += r.questoesAcertadas
    total.sessoes += r.sessoes
    if (r.ultimoEstudo && (!total.ultimoEstudo || r.ultimoEstudo > total.ultimoEstudo)) total.ultimoEstudo = r.ultimoEstudo
  }
  total.acertoPct = porcentagem(total.questoesAcertadas, total.questoesFeitas)
  return total
}
