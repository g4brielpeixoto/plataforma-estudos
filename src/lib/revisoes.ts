import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Revisao } from '@/types'

/**
  Revisões programadas ao salvar um estudo: cada intervalo (dias depois do estudo) vira uma revisão
  daquele tópico. Ficam na tabela `planner_itens` com `tipo = 'revisao'` (a do planner antigo).
*/
export const REVISOES_PADRAO = [1, 7, 21, 45]
export const REVISOES_SUGERIDAS = [1, 7, 15, 30]
export const REVISAO_MAXIMA = 365

/** Intervalos válidos, sem repetir e em ordem crescente */
export function limparIntervalos(dias: unknown): number[] {
  if (!Array.isArray(dias)) return []
  const validos = dias.map((d) => Math.round(Number(d))).filter((d) => Number.isFinite(d) && d >= 1 && d <= REVISAO_MAXIMA)
  return [...new Set(validos)].sort((a, b) => a - b)
}

export const chaveData = (d: Date) => format(d, 'yyyy-MM-dd')
/** yyyy-mm-dd → Date ao meio-dia local (sem problema de fuso) */
export const paraData = (dia: string) => parseISO(`${dia}T12:00:00`)
export const hojeChave = (agora = new Date()) => chaveData(agora)

/** O dia (yyyy-mm-dd) de cada revisão a partir do dia do estudo */
export function datasDasRevisoes(diaDoEstudo: string, intervalos: number[]): { dias: number; data: string }[] {
  return limparIntervalos(intervalos).map((dias) => ({ dias, data: chaveData(addDays(paraData(diaDoEstudo), dias)) }))
}

export interface RevisoesSeparadas {
  atrasadas: Revisao[]
  hoje: Revisao[]
  proximas: Revisao[]
  /** feitas nos últimos 7 dias, mais recente primeiro */
  feitas: Revisao[]
}

/** Atrasadas (pendentes de antes de hoje), de hoje, próximas e as feitas recentes */
export function separarRevisoes(revisoes: Revisao[], agora = new Date()): RevisoesSeparadas {
  const hoje = hojeChave(agora)
  const ordem = (a: Revisao, b: Revisao) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em)
  const pendentes = revisoes.filter((r) => !r.concluido_em).sort(ordem)
  const limiteFeitas = addDays(agora, -7).toISOString()
  return {
    atrasadas: pendentes.filter((r) => r.data < hoje),
    hoje: pendentes.filter((r) => r.data === hoje),
    proximas: pendentes.filter((r) => r.data > hoje),
    feitas: revisoes.filter((r) => r.concluido_em && r.concluido_em >= limiteFeitas).sort((a, b) => b.concluido_em!.localeCompare(a.concluido_em!)),
  }
}

/** "hoje", "amanhã", "há 3 dias", "em 5 dias" */
export function quandoRevisao(dia: string, agora = new Date()): string {
  const n = differenceInCalendarDays(paraData(dia), agora)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  return n < 0 ? `há ${-n} dias` : `em ${n} dias`
}

/** "dd/mm" de um yyyy-mm-dd */
export const diaMes = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/')
