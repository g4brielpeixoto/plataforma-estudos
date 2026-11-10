import { useMemo } from 'react'
import { CONFIG_PADRAO, disponiveis, feitosHoje, type Disponiveis, type LimitesDiarios } from '@/lib/flashcards/fila'
import type { Disciplina, FlashCartao, FlashNota, Topico } from '@/types'
import { useDisciplinas, useFlashCartoes, useFlashConfig, useFlashNotas, useFlashRevisoes, useTopicos } from './dados'

/** Dados dos flashcards já cruzados: nota de cada cartão, baralho (disciplina) de cada cartão, limites do dia */
export function useDadosFlash() {
  const notas = useFlashNotas()
  const cartoes = useFlashCartoes()
  const revisoes = useFlashRevisoes()
  const config = useFlashConfig()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()

  const carregando = notas.isLoading || cartoes.isLoading || revisoes.isLoading || config.isLoading || disciplinas.isLoading || topicos.isLoading
  const erro = notas.error || cartoes.error || revisoes.error || config.error

  const base = useMemo(() => {
    const listaNotas = notas.data ?? []
    const listaCartoes = cartoes.data ?? []
    const notaPorId = new Map<string, FlashNota>(listaNotas.map((n) => [n.id, n]))
    const disciplinaPorId = new Map<string, Disciplina>((disciplinas.data ?? []).map((d) => [d.id, d]))
    const topicoPorId = new Map<string, Topico>((topicos.data ?? []).map((t) => [t.id, t]))
    const cartoesPorNota = new Map<string, FlashCartao[]>()
    for (const c of listaCartoes) {
      const l = cartoesPorNota.get(c.nota_id)
      if (l) l.push(c)
      else cartoesPorNota.set(c.nota_id, [c])
    }
    const disciplinaDoCartao = (c: FlashCartao) => notaPorId.get(c.nota_id)?.disciplina_id ?? ''
    const disciplinaDoCartaoId = new Map(listaCartoes.map((c) => [c.id, disciplinaDoCartao(c)]))
    return { notas: listaNotas, cartoes: listaCartoes, notaPorId, disciplinaPorId, topicoPorId, cartoesPorNota, disciplinaDoCartao, disciplinaDoCartaoId }
  }, [notas.data, cartoes.data, disciplinas.data, topicos.data])

  const limites: LimitesDiarios & { retencao: number } = {
    novos_por_dia: config.data?.novos_por_dia ?? CONFIG_PADRAO.novos_por_dia,
    revisoes_por_dia: config.data?.revisoes_por_dia ?? CONFIG_PADRAO.revisoes_por_dia,
    retencao: Number(config.data?.retencao ?? CONFIG_PADRAO.retencao),
  }

  const feitos = useMemo(
    () => feitosHoje(revisoes.data ?? [], (id) => base.disciplinaDoCartaoId.get(id)),
    [revisoes.data, base.disciplinaDoCartaoId],
  )

  /** O que dá para estudar hoje num escopo (todos os baralhos, um baralho ou um tópico) */
  const disponiveisEm = (filtro: (n: FlashNota) => boolean): Disponiveis =>
    disponiveis(
      base.cartoes.filter((c) => {
        const n = base.notaPorId.get(c.nota_id)
        return !!n && filtro(n)
      }),
      base.disciplinaDoCartao,
      feitos,
      limites,
    )

  return { ...base, revisoes: revisoes.data ?? [], config: config.data ?? null, limites, feitos, disponiveisEm, carregando, erro, disciplinas: disciplinas.data ?? [], topicos: topicos.data ?? [] }
}

/** Filtro de escopo: "todos", um baralho (disciplina) e, se quiser, um tópico */
export const filtroEscopo = (disciplinaId: string | null, topicoId?: string | null) => (n: FlashNota) =>
  (!disciplinaId || n.disciplina_id === disciplinaId) && (!topicoId || n.topico_id === topicoId)
