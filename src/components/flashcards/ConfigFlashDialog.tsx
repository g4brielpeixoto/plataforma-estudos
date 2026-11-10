import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useSalvarFlashConfig } from '@/hooks/dados'
import { CONFIG_PADRAO } from '@/lib/flashcards/fila'
import { mensagemErro } from '@/lib/utils'
import type { FlashConfig } from '@/types'
import { Botao, Campo, Dialogo, Entrada, Selecao } from '../ui'

const RETENCOES = [0.8, 0.85, 0.9, 0.95]

/** Limites diários e retenção desejada (valem para todos os baralhos) */
export function ConfigFlashDialog({ aberto, aoMudar, config }: { aberto: boolean; aoMudar: (a: boolean) => void; config: FlashConfig | null }) {
  const salvar = useSalvarFlashConfig()
  const [novos, setNovos] = useState('')
  const [revisoes, setRevisoes] = useState('')
  const [retencao, setRetencao] = useState('0.9')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setNovos(String(config?.novos_por_dia ?? CONFIG_PADRAO.novos_por_dia))
    setRevisoes(String(config?.revisoes_por_dia ?? CONFIG_PADRAO.revisoes_por_dia))
    setRetencao(String(Number(config?.retencao ?? CONFIG_PADRAO.retencao)))
  }, [aberto, config])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const n = Math.floor(Number(novos))
    const r = Math.floor(Number(revisoes))
    if (!Number.isFinite(n) || n < 0 || n > 9999) return setErro('Novos por dia: use um número de 0 a 9999.')
    if (!Number.isFinite(r) || r < 0 || r > 99999) return setErro('Revisões por dia: use um número de 0 a 99999.')
    try {
      await salvar.mutateAsync({ novos_por_dia: n, revisoes_por_dia: r, retencao: Number(retencao) })
      toast.success('Ajustes salvos.')
      aoMudar(false)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo="Ajustes dos flashcards" descricao="Valem para cada baralho (disciplina), como os padrões do Anki." largura="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Novos por dia" htmlFor="c-novos">
            <Entrada id="c-novos" type="number" inputMode="numeric" min={0} max={9999} value={novos} onChange={(e) => setNovos(e.target.value)} className="numeros" />
          </Campo>
          <Campo rotulo="Revisões por dia (máx.)" htmlFor="c-revisoes">
            <Entrada id="c-revisoes" type="number" inputMode="numeric" min={0} max={99999} value={revisoes} onChange={(e) => setRevisoes(e.target.value)} className="numeros" />
          </Campo>
        </div>
        <Campo rotulo="Retenção desejada" htmlFor="c-retencao" dica="Chance de lembrar na hora da revisão. Mais alta = revisões mais frequentes. 90% é o padrão do Anki.">
          <Selecao id="c-retencao" value={retencao} onChange={(e) => setRetencao(e.target.value)}>
            {RETENCOES.map((v) => (
              <option key={v} value={String(v)}>
                {Math.round(v * 100)}%{v === 0.9 ? ' (recomendado)' : ''}
              </option>
            ))}
          </Selecao>
        </Campo>
        {erro && (
          <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar ajustes
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
