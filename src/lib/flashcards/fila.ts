import { endOfDay, startOfDay } from 'date-fns'
import type { FlashCartao, FlashConfig, FlashRevisao } from '@/types'

/*
  Fila de revisão no estilo do Anki.
  - Aprendendo (estado 1 e 3): passos curtos (1 min, 10 min). Vêm primeiro quando já venceram.
  - Revisar (estado 2) que vence até o fim do dia e Novos (estado 0): com limite diário por baralho (disciplina).
    Novos são intercalados entre as revisões.
  - Se não sobrar nada, um cartão em aprendizado que vence nos próximos 20 min é mostrado antes (como o Anki).
*/

export const ANTECIPAR_MS = 20 * 60_000

export type Fila = 'novo' | 'aprendendo' | 'revisar'

export const CONFIG_PADRAO: Pick<FlashConfig, 'novos_por_dia' | 'revisoes_por_dia' | 'retencao'> = {
  novos_por_dia: 20,
  revisoes_por_dia: 200,
  retencao: 0.9,
}

export type LimitesDiarios = Pick<FlashConfig, 'novos_por_dia' | 'revisoes_por_dia'>

/** Quantos novos e revisões cada baralho já fez hoje */
export type FeitosHoje = Map<string, { novos: number; revisoes: number }>

const vence = (c: FlashCartao) => new Date(c.vence_em).getTime()

export function feitosHoje(revisoes: FlashRevisao[], disciplinaDoCartao: (cartaoId: string) => string | undefined, agora = new Date()): FeitosHoje {
  const ini = startOfDay(agora).getTime()
  const fim = endOfDay(agora).getTime()
  const mapa: FeitosHoje = new Map()
  for (const r of revisoes) {
    const t = new Date(r.revisado_em).getTime()
    if (t < ini || t > fim) continue
    if (r.estado_antes !== 0 && r.estado_antes !== 2) continue
    const d = disciplinaDoCartao(r.cartao_id)
    if (!d) continue
    const atual = mapa.get(d) ?? { novos: 0, revisoes: 0 }
    if (r.estado_antes === 0) atual.novos++
    else atual.revisoes++
    mapa.set(d, atual)
  }
  return mapa
}

export interface Disponiveis {
  aprendendo: FlashCartao[]
  revisar: FlashCartao[]
  novos: FlashCartao[]
}

/**
  O que ainda dá para estudar hoje, respeitando os limites de cada baralho.
  `cartoes` já deve estar filtrado pelo escopo (baralho/tópico) e sem os suspensos.
*/
export function disponiveis(
  cartoes: FlashCartao[],
  disciplinaDoCartao: (c: FlashCartao) => string,
  feitos: FeitosHoje,
  limites: LimitesDiarios,
  agora = new Date(),
): Disponiveis {
  const fim = endOfDay(agora).getTime()
  const aprendendo: FlashCartao[] = []
  const porBaralho = new Map<string, { revisar: FlashCartao[]; novos: FlashCartao[] }>()
  for (const c of cartoes) {
    if (c.suspenso) continue
    if (c.estado === 1 || c.estado === 3) {
      if (vence(c) <= fim) aprendendo.push(c)
      continue
    }
    const d = disciplinaDoCartao(c)
    const grupo = porBaralho.get(d) ?? { revisar: [], novos: [] }
    if (c.estado === 2 && vence(c) <= fim) grupo.revisar.push(c)
    else if (c.estado === 0) grupo.novos.push(c)
    porBaralho.set(d, grupo)
  }
  const revisar: FlashCartao[] = []
  const novos: FlashCartao[] = []
  for (const [d, g] of porBaralho) {
    const f = feitos.get(d) ?? { novos: 0, revisoes: 0 }
    const limR = Math.max(0, limites.revisoes_por_dia - f.revisoes)
    const limN = Math.max(0, limites.novos_por_dia - f.novos)
    revisar.push(...g.revisar.sort((a, b) => vence(a) - vence(b)).slice(0, limR))
    novos.push(...g.novos.sort((a, b) => a.posicao - b.posicao || a.criado_em.localeCompare(b.criado_em) || a.ordem - b.ordem).slice(0, limN))
  }
  aprendendo.sort((a, b) => vence(a) - vence(b))
  revisar.sort((a, b) => vence(a) - vence(b))
  return { aprendendo, revisar, novos }
}

export const contagem = (d: Disponiveis) => ({ novos: d.novos.length, aprendendo: d.aprendendo.length, revisar: d.revisar.length })

/**
  Próximo cartão da sessão. `respondidos` = quantos novos/revisões já foram respondidos na sessão
  (para intercalar os novos entre as revisões).
*/
export function proximoCartao(d: Disponiveis, respondidos: number, agora = new Date()): { cartao: FlashCartao; fila: Fila } | null {
  const t = agora.getTime()
  const aprendendoAgora = d.aprendendo.find((c) => vence(c) <= t)
  if (aprendendoAgora) return { cartao: aprendendoAgora, fila: 'aprendendo' }
  if (d.revisar.length && d.novos.length) {
    const passo = Math.max(1, Math.round((d.revisar.length + d.novos.length) / d.novos.length))
    return respondidos % passo === passo - 1 ? { cartao: d.novos[0], fila: 'novo' } : { cartao: d.revisar[0], fila: 'revisar' }
  }
  if (d.revisar.length) return { cartao: d.revisar[0], fila: 'revisar' }
  if (d.novos.length) return { cartao: d.novos[0], fila: 'novo' }
  const adiantado = d.aprendendo.find((c) => vence(c) <= t + ANTECIPAR_MS)
  if (adiantado) return { cartao: adiantado, fila: 'aprendendo' }
  return null
}

/** Quando volta o próximo cartão em aprendizado (se houver hoje) */
export function proximoAprendizado(d: Disponiveis): Date | null {
  return d.aprendendo.length ? new Date(d.aprendendo[0].vence_em) : null
}
