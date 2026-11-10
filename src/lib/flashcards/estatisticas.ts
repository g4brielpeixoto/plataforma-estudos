import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from 'date-fns'
import type { FlashCartao, FlashRevisao } from '@/types'

/** Intervalo a partir do qual o Anki chama o cartão de "maduro" */
export const DIAS_MADURO = 21

export function contagemPorEstado(cartoes: FlashCartao[]) {
  const r = { novos: 0, aprendendo: 0, jovens: 0, maduros: 0, suspensos: 0, total: cartoes.length }
  for (const c of cartoes) {
    if (c.suspenso) r.suspensos++
    else if (c.estado === 0) r.novos++
    else if (c.estado === 1 || c.estado === 3) r.aprendendo++
    else if (c.dias_agendados >= DIAS_MADURO) r.maduros++
    else r.jovens++
  }
  return r
}

export interface ResumoRevisoes {
  total: number
  acertos: number
  /** % de respostas diferentes de "Errei" (null sem revisões) */
  acertoPct: number | null
  duracaoMs: number
}

export function resumir(revisoes: FlashRevisao[]): ResumoRevisoes {
  let acertos = 0
  let duracaoMs = 0
  for (const r of revisoes) {
    if (r.resposta !== 1) acertos++
    duracaoMs += r.duracao_ms
  }
  return { total: revisoes.length, acertos, acertoPct: revisoes.length ? Math.round((acertos / revisoes.length) * 100) : null, duracaoMs }
}

export const chaveDia = (d: Date) => format(d, 'yyyy-MM-dd')

export function revisoesDoDia(revisoes: FlashRevisao[], dia = new Date()) {
  const k = chaveDia(dia)
  return revisoes.filter((r) => chaveDia(new Date(r.revisado_em)) === k)
}

/** Dias seguidos com pelo menos uma revisão (contando até hoje; se hoje ainda não teve, até ontem) */
export function sequenciaDias(revisoes: FlashRevisao[], hoje = new Date()) {
  const dias = new Set(revisoes.map((r) => chaveDia(new Date(r.revisado_em))))
  let d = startOfDay(hoje)
  if (!dias.has(chaveDia(d))) d = subDays(d, 1)
  let n = 0
  while (dias.has(chaveDia(d))) {
    n++
    d = subDays(d, 1)
  }
  return n
}

/** Revisões por dia nos últimos N dias (do mais antigo para hoje) */
export function porDia(revisoes: FlashRevisao[], dias = 30, hoje = new Date()) {
  const mapa = new Map<string, { total: number; acertos: number }>()
  for (const r of revisoes) {
    const k = chaveDia(new Date(r.revisado_em))
    const v = mapa.get(k) ?? { total: 0, acertos: 0 }
    v.total++
    if (r.resposta !== 1) v.acertos++
    mapa.set(k, v)
  }
  const inicio = subDays(startOfDay(hoje), dias - 1)
  return Array.from({ length: dias }, (_, i) => {
    const dia = addDays(inicio, i)
    return { dia, ...(mapa.get(chaveDia(dia)) ?? { total: 0, acertos: 0 }) }
  })
}

/** Quantos cartões vencem em cada um dos próximos N dias (hoje inclui os atrasados) */
export function previsao(cartoes: FlashCartao[], dias = 7, hoje = new Date()) {
  const ini = startOfDay(hoje)
  const contagem = Array.from({ length: dias }, (_, i) => ({ dia: addDays(ini, i), total: 0 }))
  for (const c of cartoes) {
    if (c.suspenso || c.estado === 0) continue
    const idx = Math.max(0, differenceInCalendarDays(new Date(c.vence_em), ini))
    if (idx < dias) contagem[idx].total++
  }
  return contagem
}
