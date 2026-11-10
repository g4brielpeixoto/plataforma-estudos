import { fsrs, generatorParameters, Rating, type Card, type FSRS, type Grade, type State } from 'ts-fsrs'
import type { EstadoCartao, FlashCartao, RespostaFlash } from '@/types'

/*
  Agendamento com FSRS (o algoritmo que o Anki usa hoje), pela biblioteca ts-fsrs.
  Passos de aprendizado iguais aos padrões do Anki: 1 min e 10 min; reaprendizado: 10 min.
*/

export type Agendador = FSRS

export function criarAgendador(retencao = 0.9): Agendador {
  return fsrs(
    generatorParameters({
      request_retention: retencao,
      maximum_interval: 36500,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    }),
  )
}

export function paraFsrs(c: FlashCartao): Card {
  return {
    due: new Date(c.vence_em),
    stability: c.estabilidade,
    difficulty: c.dificuldade,
    elapsed_days: 0,
    scheduled_days: c.dias_agendados,
    learning_steps: c.passo,
    reps: c.repeticoes,
    lapses: c.lapsos,
    state: c.estado as unknown as State,
    last_review: c.ultima_revisao ? new Date(c.ultima_revisao) : undefined,
  }
}

/** Campos do agendamento que vão para o banco */
export type CamposAgenda = Pick<
  FlashCartao,
  'estado' | 'vence_em' | 'estabilidade' | 'dificuldade' | 'dias_agendados' | 'passo' | 'repeticoes' | 'lapsos' | 'ultima_revisao'
>

export function deFsrs(card: Card): CamposAgenda {
  return {
    estado: card.state as unknown as EstadoCartao,
    vence_em: card.due.toISOString(),
    estabilidade: Math.max(0, card.stability),
    dificuldade: Math.min(10, Math.max(0, card.difficulty)),
    dias_agendados: Math.max(0, Math.round(card.scheduled_days)),
    passo: Math.max(0, card.learning_steps ?? 0),
    repeticoes: card.reps,
    lapsos: card.lapses,
    ultima_revisao: card.last_review ? card.last_review.toISOString() : null,
  }
}

const NOTA: Record<RespostaFlash, Grade> = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy }

/** Resultado de responder o cartão agora */
export function responder(agendador: Agendador, c: FlashCartao, resposta: RespostaFlash, agora = new Date()): FlashCartao {
  const { card } = agendador.next(paraFsrs(c), agora, NOTA[resposta])
  return { ...c, ...deFsrs(card) }
}

/** O que cada botão faria (para mostrar o intervalo em cima dele) */
export function previa(agendador: Agendador, c: FlashCartao, agora = new Date()): Record<RespostaFlash, { cartao: FlashCartao; rotulo: string }> {
  const r = agendador.repeat(paraFsrs(c), agora)
  const item = (n: RespostaFlash) => {
    const cartao = { ...c, ...deFsrs(r[NOTA[n]].card) }
    return { cartao, rotulo: rotuloIntervalo(new Date(cartao.vence_em).getTime() - agora.getTime()) }
  }
  return { 1: item(1), 2: item(2), 3: item(3), 4: item(4) }
}

const virgula = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

/** 30 s → "<1 min"; 10 min; 3 h; 4 dias; 1,5 mês; 2 anos */
export function rotuloIntervalo(ms: number): string {
  const min = ms / 60_000
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = min / 60
  if (h < 24) return `${Math.round(h)} h`
  const dias = Math.round(h / 24)
  if (dias < 30) return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
  const meses = Math.round((dias / 30) * 10) / 10
  if (dias < 365) return `${virgula(meses)} ${meses < 2 ? 'mês' : 'meses'}`
  const anos = Math.round((dias / 365) * 10) / 10
  return `${virgula(anos)} ${anos < 2 ? 'ano' : 'anos'}`
}

/** Volta o cartão a "novo" (esquecer) */
export const camposDeNovo = (): CamposAgenda => ({
  estado: 0,
  vence_em: new Date().toISOString(),
  estabilidade: 0,
  dificuldade: 0,
  dias_agendados: 0,
  passo: 0,
  repeticoes: 0,
  lapsos: 0,
  ultima_revisao: null,
})
