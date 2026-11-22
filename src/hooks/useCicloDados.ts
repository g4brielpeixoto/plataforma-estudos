import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useCiclo, useCicloMetas, useDisciplinas, useSalvarCiclo, useTopicos } from '@/hooks/dados'
import { proximaMetaDaDisciplina, resolverCiclo, siglaDe, situacaoDasMetas, type SituacaoMeta } from '@/lib/ciclos'
import type { Disciplina } from '@/types'

/**
  Tudo do ciclo já cruzado: metas com a situação (cumprida ou não), a sequência, a posição e a meta da vez.
  Quando a meta da vez é cumprida (todos os tópicos concluídos), grava sozinho a passagem para a próxima
  disciplina do ciclo que ainda tem meta pendente.
*/
export function useCicloDados() {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const metas = useCicloMetas()
  const ciclo = useCiclo()
  const salvarCiclo = useSalvarCiclo()

  const carregando = disciplinas.isLoading || topicos.isLoading || metas.isLoading || ciclo.isLoading
  const listaMetas = useMemo(() => metas.data ?? [], [metas.data])
  const situacao = useMemo(() => situacaoDasMetas(listaMetas, topicos.data ?? []), [listaMetas, topicos.data])
  const disciplinaPorId = useMemo(() => new Map((disciplinas.data ?? []).map((d) => [d.id, d])), [disciplinas.data])

  // a sequência só com disciplinas que ainda existem
  const sequencia = useMemo(() => (ciclo.data?.sequencia ?? []).filter((id) => disciplinaPorId.has(id)), [ciclo.data, disciplinaPorId])
  const estado = useMemo(
    () => resolverCiclo({ sequencia, posicao: ciclo.data?.posicao ?? 0, meta_id: ciclo.data?.meta_id ?? null }, listaMetas, situacao),
    [sequencia, ciclo.data, listaMetas, situacao],
  )

  // grava a passagem (uma vez por mudança)
  const gravado = useRef('')
  useEffect(() => {
    if (carregando || !ciclo.data || !estado.mudou || salvarCiclo.isPending) return
    const chave = `${estado.posicao}:${estado.metaId}`
    if (gravado.current === chave) return
    gravado.current = chave
    const anterior = ciclo.data.meta_id ? situacao.get(ciclo.data.meta_id) : undefined
    salvarCiclo.mutate(
      { sequencia, posicao: estado.posicao, meta_id: estado.metaId },
      {
        onSuccess: () => {
          if (!anterior?.cumprida || !estado.metaId) return
          const prox = situacao.get(estado.metaId)
          const d = prox && disciplinaPorId.get(prox.meta.disciplina_id)
          if (prox && d) toast.success(`Meta cumprida! Agora é ${siglaDe(d)} · Meta ${prox.numero}.`)
        },
      },
    )
  }, [carregando, ciclo.data, estado, sequencia, situacao, disciplinaPorId, salvarCiclo])

  const metaDaVez = estado.metaId ? situacao.get(estado.metaId) : undefined
  const proximaDe = (disciplinaId: string): SituacaoMeta | undefined => proximaMetaDaDisciplina(disciplinaId, listaMetas, situacao)

  return {
    carregando,
    erro: disciplinas.error ?? topicos.error ?? metas.error ?? ciclo.error,
    disciplinas: disciplinas.data ?? [],
    disciplinaPorId,
    topicos: topicos.data ?? [],
    metas: listaMetas,
    situacao,
    ciclo: ciclo.data ?? null,
    sequencia,
    posicao: estado.posicao,
    terminou: estado.terminou,
    metaDaVez,
    disciplinaDaVez: metaDaVez ? disciplinaPorId.get(metaDaVez.meta.disciplina_id) : (undefined as Disciplina | undefined),
    proximaDe,
    /** passa para a próxima disciplina sem cumprir a meta da vez */
    pular: () => {
      const e = resolverCiclo({ sequencia, posicao: estado.posicao, meta_id: estado.metaId }, listaMetas, situacao, true)
      gravado.current = `${e.posicao}:${e.metaId}`
      salvarCiclo.mutate({ sequencia, posicao: e.posicao, meta_id: e.metaId })
    },
    salvarCiclo,
  }
}

export type CicloDados = ReturnType<typeof useCicloDados>
