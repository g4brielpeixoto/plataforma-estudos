import { addDays, differenceInCalendarDays } from 'date-fns'
import type { Estudo, ItemPlanner } from '@/types'
import { chaveData, paraData } from './planner'

/*
  Revisão pelo acerto nas questões. Nada é gravado: tudo sai dos estudos e do planner.

  - Cada tópico e cada subtópico tem a sua revisão, só com as questões lançadas nele
    (o subtópico não soma no pai: são assuntos separados).
  - Vale a última sessão do tópico com MIN_QUESTOES ou mais (com menos, a porcentagem engana).
  - Quanto pior o acerto, mais cedo volta: < 60% em 3 dias, 60–74% em 7, 75–84% em 15,
    85–94% em 30 e 95% ou mais em 60. Assim só o que dá trabalho volta logo.
  - As faixas de 85% para cima só valem com MIN_QUESTOES_DOMINIO questões ou mais na sessão
    (5 de 5 dá 100%, mas é pouco para mandar o tópico para longe): com menos, o teto é 15 dias.
  - Mantendo 85% ou mais (com questões suficientes) em sessões seguidas, o intervalo dobra a cada
    uma, até INTERVALO_MAXIMO. De 75 a 84% não dobra: fica em 15 até subir de faixa.
  - Caiu de faixa, vale o intervalo curto da faixa nova, sem média com o histórico bom.
  - Uma revisão marcada como feita no planner depois da última sessão (sem registrar questões)
    empurra a próxima pelo mesmo intervalo.
  - Tópico com revisão pendente no planner já está agendado: sai da fila.
*/

export const MIN_QUESTOES = 5
/** mínimo de questões na sessão para as faixas de 85% para cima valerem */
export const MIN_QUESTOES_DOMINIO = 10
export const INTERVALO_MAXIMO = 120

/** A sessão mostra domínio: 85% ou mais, com questões suficientes para confiar no número */
const dominou = (pct: number, feitas: number) => pct >= 85 && feitas >= MIN_QUESTOES_DOMINIO

/**
 * Dias até a próxima revisão: pelo acerto e pelo tamanho da sessão, e por quantas sessões seguidas
 * (contando esta) mostraram domínio.
 */
export function intervaloRevisao(pct: number, feitas: number, seguidasDominando = 1): number {
  if (pct < 60) return 3
  if (pct < 75) return 7
  if (!dominou(pct, feitas)) return 15
  const base = pct < 95 ? 30 : 60
  return Math.min(INTERVALO_MAXIMO, base * 2 ** Math.max(0, seguidasDominando - 1))
}

type Sessao = Pick<Estudo, 'topico_id' | 'data_hora' | 'questoes_feitas' | 'questoes_acertadas'>

export const pctSessao = (s: Pick<Estudo, 'questoes_feitas' | 'questoes_acertadas'>) => Math.round(((s.questoes_acertadas ?? 0) / (s.questoes_feitas as number)) * 100)

const contaParaRevisao = (s: Pick<Estudo, 'questoes_feitas'>) => (s.questoes_feitas ?? 0) >= MIN_QUESTOES

export interface Revisao {
  topicoId: string
  /** acerto da última sessão que conta */
  pct: number
  feitas: number
  acertadas: number
  /** dia (yyyy-mm-dd) da última sessão que conta */
  ultimaSessao: string
  intervalo: number
  /** dia (yyyy-mm-dd) em que a revisão vence */
  venceEm: string
}

/** A revisão de um tópico a partir das sessões dele (em qualquer ordem); null se nenhuma sessão conta */
export function revisaoDoTopico(sessoes: Sessao[], revisoesFeitas: string[] = []): Revisao | null {
  const validas = sessoes.filter(contaParaRevisao).sort((a, b) => a.data_hora.localeCompare(b.data_hora))
  const ultima = validas[validas.length - 1]
  if (!ultima) return null
  const pct = pctSessao(ultima)
  let seguidas = 0
  for (let i = validas.length - 1; i >= 0 && dominou(pctSessao(validas[i]), validas[i].questoes_feitas as number); i--) seguidas++
  const intervalo = intervaloRevisao(pct, ultima.questoes_feitas as number, seguidas)
  const ultimaSessao = chaveData(new Date(ultima.data_hora))
  // revisão feita depois da sessão (marcada no planner sem lançar questões) conta como a nova base
  const base = revisoesFeitas.reduce((m, d) => (d > m ? d : m), ultimaSessao)
  return {
    topicoId: ultima.topico_id,
    pct,
    feitas: ultima.questoes_feitas as number,
    acertadas: ultima.questoes_acertadas ?? 0,
    ultimaSessao,
    intervalo,
    venceEm: chaveData(addDays(paraData(base), intervalo)),
  }
}

/** Revisões de todos os tópicos que têm sessão que conta */
export function revisoes(estudos: Sessao[], planner: Pick<ItemPlanner, 'topico_id' | 'tipo' | 'concluido_em'>[] = []): Revisao[] {
  const porTopico = new Map<string, Sessao[]>()
  for (const e of estudos) {
    if (!contaParaRevisao(e)) continue
    const lista = porTopico.get(e.topico_id)
    if (lista) lista.push(e)
    else porTopico.set(e.topico_id, [e])
  }
  const feitas = new Map<string, string[]>()
  for (const i of planner) {
    if (i.tipo !== 'revisao' || !i.topico_id || !i.concluido_em) continue
    const dia = chaveData(new Date(i.concluido_em))
    const lista = feitas.get(i.topico_id)
    if (lista) lista.push(dia)
    else feitas.set(i.topico_id, [dia])
  }
  const saida: Revisao[] = []
  for (const [topicoId, sessoes] of porTopico) {
    const r = revisaoDoTopico(sessoes, feitas.get(topicoId))
    if (r) saida.push(r)
  }
  return saida
}

/** Tópicos que já têm uma revisão pendente no planner (em qualquer dia) */
export function comRevisaoAgendada(planner: Pick<ItemPlanner, 'topico_id' | 'tipo' | 'concluido_em'>[]): Set<string> {
  const ids = new Set<string>()
  for (const i of planner) if (i.tipo === 'revisao' && i.topico_id && !i.concluido_em) ids.add(i.topico_id)
  return ids
}

export interface RevisaoVencida extends Revisao {
  /** dias desde o vencimento (0 = vence hoje) */
  atraso: number
}

/**
 * A fila "Para revisar": revisões vencidas (hoje ou antes) de tópicos sem revisão pendente no planner,
 * do pior acerto para o melhor (empate: a que venceu há mais tempo).
 */
export function paraRevisar(estudos: Sessao[], planner: Pick<ItemPlanner, 'topico_id' | 'tipo' | 'concluido_em'>[], hoje: string, topicosValidos?: Set<string>): RevisaoVencida[] {
  const agendadas = comRevisaoAgendada(planner)
  return revisoes(estudos, planner)
    .filter((r) => r.venceEm <= hoje && !agendadas.has(r.topicoId) && (!topicosValidos || topicosValidos.has(r.topicoId)))
    .map((r) => ({ ...r, atraso: differenceInCalendarDays(paraData(hoje), paraData(r.venceEm)) }))
    .sort((a, b) => a.pct - b.pct || b.atraso - a.atraso || a.topicoId.localeCompare(b.topicoId))
}

/** "vence hoje", "venceu ontem", "venceu há 4 dias" */
export const textoAtraso = (atraso: number) => (atraso <= 0 ? 'vence hoje' : atraso === 1 ? 'venceu ontem' : `venceu há ${atraso} dias`)

/** "amanhã", "em 3 dias" */
export const textoIntervalo = (dias: number) => (dias === 1 ? 'amanhã' : `em ${dias} dias`)
