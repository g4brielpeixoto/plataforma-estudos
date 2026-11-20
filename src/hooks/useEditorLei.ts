import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { chaves, gravarLinhasDaLei, useLeiLinhas } from '@/hooks/dados'
import { mensagemErro } from '@/lib/utils'
import type { LeiLinha } from '@/types'

const igual = (a: LeiLinha, b: LeiLinha) =>
  a.ordem === b.ordem && a.nivel === b.nivel && a.texto === b.texto && a.incidencia === b.incidencia && a.revisado_em === b.revisado_em && a.nota_id === b.nota_id

/**
 * As linhas de uma lei, editadas na tela e gravadas por trás.
 * A tela trabalha numa cópia (a resposta é imediata) e uma sincronização compara a cópia com o que já está no banco,
 * enviando só o que mudou; edições seguidas se juntam numa gravação só.
 */
export function useEditorLei(leiId: string | undefined) {
  const consulta = useLeiLinhas()
  const qc = useQueryClient()
  const [linhas, setLinhas] = useState<LeiLinha[] | null>(null)
  const [pendente, setPendente] = useState(false)
  const local = useRef<LeiLinha[]>([])
  const servidor = useRef<Map<string, LeiLinha>>(new Map())
  const rodando = useRef(false)
  const falhou = useRef(false)
  const carregada = useRef<string | undefined>(undefined)

  // começa (ou recomeça, ao trocar de lei) com o que veio do banco
  useEffect(() => {
    if (!leiId || !consulta.data || consulta.isFetching || carregada.current === leiId) return
    const minhas = consulta.data
      .filter((l) => l.lei_id === leiId)
      .sort((a, b) => a.ordem - b.ordem)
      .map((l, i) => ({ ...l, ordem: i }))
    carregada.current = leiId
    local.current = minhas
    servidor.current = new Map(consulta.data.filter((l) => l.lei_id === leiId).map((l) => [l.id, l]))
    setLinhas(minhas)
    void sincronizar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leiId, consulta.data, consulta.isFetching])

  const sincronizar = useCallback(async () => {
    if (rodando.current || !leiId) return
    rodando.current = true
    setPendente(true)
    try {
      for (;;) {
        const alvo = local.current
        const gravar = alvo.filter((l) => {
          const s = servidor.current.get(l.id)
          return !s || !igual(s, l)
        })
        const ids = new Set(alvo.map((l) => l.id))
        const apagar = [...servidor.current.keys()].filter((id) => !ids.has(id))
        if (!gravar.length && !apagar.length) break
        await gravarLinhasDaLei(gravar, apagar)
        for (const l of gravar) servidor.current.set(l.id, l)
        for (const id of apagar) servidor.current.delete(id)
        // as outras telas (lista de leis, revisão) leem do cache
        qc.setQueryData<LeiLinha[]>(chaves.leiLinhas, (todas) => [...(todas ?? []).filter((l) => l.lei_id !== leiId), ...alvo])
      }
      falhou.current = false
      setPendente(false)
    } catch (e) {
      if (!falhou.current) toast.error(`Não foi possível salvar a lei: ${mensagemErro(e)}. Confira a conexão; o app tenta de novo na próxima mudança.`)
      falhou.current = true
    } finally {
      rodando.current = false
    }
  }, [leiId, qc])

  /** Troca a lista inteira (a ordem das linhas é a posição na lista) */
  const mudar = useCallback(
    (fn: (atual: LeiLinha[]) => LeiLinha[]) => {
      const nova = fn(local.current).map((l, i) => (l.ordem === i ? l : { ...l, ordem: i }))
      local.current = nova
      setLinhas(nova)
      void sincronizar()
    },
    [sincronizar],
  )

  // sair com gravação pendente: o navegador pergunta antes de fechar
  useEffect(() => {
    if (!pendente) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendente])

  return { linhas: carregada.current === leiId ? linhas : null, mudar, pendente, erro: consulta.error }
}
