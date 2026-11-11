import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDisciplinas, usePlanner, useSalvarItemPlanner, useTopicos } from '@/hooks/dados'
import { COR_TIPO, hojeChave, moverItem, proximaOrdem, rotuloMinutos, TIPOS } from '@/lib/planner'
import { rotuloSelecao } from '@/lib/topicos'
import { cn, mensagemErro } from '@/lib/utils'
import type { ItemPlanner, TipoPlanner } from '@/types'
import { AreaTexto, Botao, Campo, Dialogo, Entrada, Selecao } from './ui'

const DURACOES = [30, 60, 90, 120, 180]

/** Criar ou editar um item do planner */
export function PlannerItemDialog({
  aberto,
  aoMudar,
  item,
  dataInicial,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  item?: ItemPlanner | null
  dataInicial?: string
}) {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const planner = usePlanner()
  const salvar = useSalvarItemPlanner()

  const [data, setData] = useState(hojeChave())
  const [tipo, setTipo] = useState<TipoPlanner>('estudo')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [topicoId, setTopicoId] = useState('')
  const [minutos, setMinutos] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setData(item?.data ?? dataInicial ?? hojeChave())
    setTipo(item?.tipo ?? 'estudo')
    setDisciplinaId(item?.disciplina_id ?? '')
    setTopicoId(item?.topico_id ?? '')
    setMinutos(item?.minutos_previstos?.toString() ?? '')
    setObservacao(item?.observacao ?? '')
  }, [aberto, item, dataInicial])

  const topicosDaDisciplina = useMemo(() => (topicos.data ?? []).filter((t) => t.disciplina_id === disciplinaId), [topicos.data, disciplinaId])
  const minutosNum = minutos.trim() === '' ? null : Math.floor(Number(minutos))

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!data) return setErro('Escolha o dia.')
    if (!disciplinaId) return setErro('Escolha a disciplina.')
    if (minutosNum !== null && (!Number.isFinite(minutosNum) || minutosNum < 1 || minutosNum > 1440)) return setErro('O tempo previsto vai de 1 a 1440 minutos (24 h).')
    const todos = planner.data ?? []
    const dados = {
      data,
      tipo,
      disciplina_id: disciplinaId,
      topico_id: topicoId || null,
      minutos_previstos: minutosNum,
      observacao: observacao.trim() || null,
    }
    try {
      if (item) {
        // trocar o dia pela edição segue a mesma regra de mover (vai para o fim do dia e pode contar adiamento)
        const movido = item.data !== data ? moverItem(item, data, todos) : item
        await salvar.mutateAsync({ id: item.id, dados: { ...dados, ordem: movido.ordem, adiamentos: movido.adiamentos } })
        toast.success('Item atualizado.')
      } else {
        await salvar.mutateAsync({ dados: { ...dados, ordem: proximaOrdem(todos, data) } })
        toast.success('Item adicionado ao planner.')
      }
      aoMudar(false)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const semDisciplinas = !disciplinas.isLoading && (disciplinas.data ?? []).length === 0

  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo={item ? 'Editar item' : 'Planejar estudo'} descricao={item ? undefined : 'Escolha o dia, o que estudar e, se quiser, quanto tempo.'}>
      {semDisciplinas ? (
        <div className="rounded-2xl bg-superficie-2 p-5 text-center">
          <p className="font-medium text-tinta">Você ainda não tem disciplinas.</p>
          <p className="mt-1 text-sm text-tinta-suave">Cadastre o edital primeiro para poder planejar.</p>
          <Link to="/edital" onClick={() => aoMudar(false)} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria">
            Ir para o edital
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-tinta">Tipo</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {TIPOS.map((t) => (
                <label
                  key={t.valor}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primaria/50',
                    tipo === t.valor ? cn('border-transparent text-tinta', COR_TIPO[t.valor].fundo) : 'border-linha text-tinta-suave hover:text-tinta',
                  )}
                >
                  <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => setTipo(t.valor)} className="sr-only" />
                  <span className={cn('size-2.5 rounded-full', COR_TIPO[t.valor].barra)} aria-hidden />
                  {t.rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Campo rotulo="Dia" htmlFor="p-data">
              <Entrada id="p-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
            <Campo rotulo="Disciplina" htmlFor="p-disciplina">
              <Selecao
                id="p-disciplina"
                value={disciplinaId}
                onChange={(e) => {
                  setDisciplinaId(e.target.value)
                  setTopicoId('')
                }}
              >
                <option value="">Escolha…</option>
                {(disciplinas.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <Campo rotulo="Tópico (opcional)" htmlFor="p-topico">
            <Selecao id="p-topico" value={topicoId} onChange={(e) => setTopicoId(e.target.value)} disabled={!disciplinaId}>
              <option value="">{disciplinaId && topicosDaDisciplina.length === 0 ? 'Disciplina sem tópicos' : 'Sem tópico definido'}</option>
              {topicosDaDisciplina.map((t) => (
                <option key={t.id} value={t.id}>
                  {rotuloSelecao(t, topicos.data ?? [])}
                  {t.concluido ? ' ✓' : ''}
                </option>
              ))}
            </Selecao>
          </Campo>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-tinta">Tempo previsto (opcional)</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {DURACOES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutosNum === m}
                  onClick={() => setMinutos(minutosNum === m ? '' : String(m))}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium numeros transition-colors',
                    minutosNum === m ? 'bg-primaria text-sobre-primaria' : 'bg-superficie-2 text-tinta-suave hover:text-tinta',
                  )}
                >
                  {rotuloMinutos(m)}
                </button>
              ))}
              <span className="flex items-center gap-1.5">
                <Entrada
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  placeholder="outro"
                  aria-label="Tempo previsto em minutos"
                  value={minutosNum !== null && DURACOES.includes(minutosNum) ? '' : minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  className="h-8 w-20 rounded-full text-sm numeros"
                />
                <span className="text-sm text-tinta-suave">min</span>
              </span>
            </div>
          </fieldset>

          <Campo rotulo="Observação (opcional)" htmlFor="p-obs">
            <AreaTexto
              id="p-obs"
              rows={2}
              maxLength={500}
              className="min-h-0"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: 30 questões da banca, reler a lei seca, fazer mapa mental…"
            />
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
              {item ? 'Salvar alterações' : 'Adicionar ao planner'}
            </Botao>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
