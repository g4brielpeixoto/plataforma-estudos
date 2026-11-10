import { format } from 'date-fns'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDisciplinas, useSalvarEstudo, useTopicos } from '@/hooks/dados'
import { formatarDuracao, mensagemErro } from '@/lib/utils'
import type { Estudo, Origem } from '@/types'
import { AreaTexto, Botao, Campo, Dialogo, Entrada, Selecao } from './ui'

export interface ValoresIniciaisEstudo {
  duracaoSegundos?: number
  origem?: Origem
  disciplinaId?: string
  topicoId?: string
}

const ROTULO_ORIGEM: Record<Origem, string> = {
  manual: 'Lançamento manual',
  cronometro: 'Cronômetro',
  timer: 'Timer',
  pomodoro: 'Pomodoro',
}

const paraLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")
const numero = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))))

export function EstudoDialog({
  aberto,
  aoMudar,
  editando,
  iniciais,
  aoSalvar,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  editando?: Estudo | null
  iniciais?: ValoresIniciaisEstudo
  aoSalvar?: () => void
}) {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const salvar = useSalvarEstudo()

  const [disciplinaId, setDisciplinaId] = useState('')
  const [topicoId, setTopicoId] = useState('')
  const [dataHora, setDataHora] = useState(paraLocal(new Date()))
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('')
  const [feitas, setFeitas] = useState('')
  const [acertadas, setAcertadas] = useState('')
  const [observacao, setObservacao] = useState('')
  const [concluir, setConcluir] = useState(false)
  const [erro, setErro] = useState('')
  const [origem, setOrigem] = useState<Origem>('manual')

  const preencherDuracao = (segundos: number) => {
    const totalMin = Math.round(segundos / 60)
    setHoras(totalMin >= 60 ? String(Math.floor(totalMin / 60)) : '')
    setMinutos(totalMin ? String(totalMin % 60) : '')
  }

  // preenche o formulário ao abrir
  useEffect(() => {
    if (!aberto) return
    setErro('')
    const todos = topicos.data ?? []
    if (editando) {
      const t = todos.find((x) => x.id === editando.topico_id)
      setDisciplinaId(t?.disciplina_id ?? '')
      setTopicoId(editando.topico_id)
      setDataHora(paraLocal(new Date(editando.data_hora)))
      preencherDuracao(editando.duracao_segundos ?? 0)
      setFeitas(editando.questoes_feitas?.toString() ?? '')
      setAcertadas(editando.questoes_acertadas?.toString() ?? '')
      setObservacao(editando.observacao ?? '')
      setConcluir(t?.concluido ?? false)
      setOrigem(editando.origem)
    } else {
      const t = iniciais?.topicoId ? todos.find((x) => x.id === iniciais.topicoId) : undefined
      setDisciplinaId(t?.disciplina_id ?? iniciais?.disciplinaId ?? '')
      setTopicoId(t?.id ?? '')
      setDataHora(paraLocal(new Date()))
      preencherDuracao(iniciais?.duracaoSegundos ?? 0)
      setFeitas('')
      setAcertadas('')
      setObservacao('')
      setConcluir(t?.concluido ?? false)
      setOrigem(iniciais?.origem ?? 'manual')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando])

  const topicosDaDisciplina = useMemo(
    () => (topicos.data ?? []).filter((t) => t.disciplina_id === disciplinaId),
    [topicos.data, disciplinaId],
  )
  const topicoSelecionado = topicosDaDisciplina.find((t) => t.id === topicoId)

  const escolherTopico = (id: string) => {
    setTopicoId(id)
    setConcluir(topicosDaDisciplina.find((t) => t.id === id)?.concluido ?? false)
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!topicoId) return setErro('Escolha a disciplina e o tópico estudado.')
    const segundos = ((numero(horas) ?? 0) * 60 + (numero(minutos) ?? 0)) * 60
    const qFeitas = numero(feitas)
    const qAcertadas = numero(acertadas)
    if (!segundos && !qFeitas) return setErro('Informe o tempo estudado, as questões feitas ou os dois.')
    if (qAcertadas !== null && qFeitas === null) return setErro('Informe quantas questões você fez.')
    if (qAcertadas !== null && qFeitas !== null && qAcertadas > qFeitas) return setErro('Os acertos não podem passar do número de questões feitas.')

    try {
      await salvar.mutateAsync({
        id: editando?.id,
        estudo: {
          topico_id: topicoId,
          data_hora: new Date(dataHora).toISOString(),
          duracao_segundos: segundos || null,
          questoes_feitas: qFeitas || null,
          questoes_acertadas: qFeitas ? (qAcertadas ?? 0) : null,
          origem,
          observacao: observacao.trim() || null,
        },
        concluirTopico: topicoSelecionado && topicoSelecionado.concluido !== concluir ? concluir : undefined,
      })
      toast.success(editando ? 'Estudo atualizado.' : 'Estudo salvo.')
      aoMudar(false)
      aoSalvar?.()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const semDisciplinas = !disciplinas.isLoading && (disciplinas.data ?? []).length === 0
  const duracaoInicial = !editando && iniciais?.duracaoSegundos ? iniciais.duracaoSegundos : 0

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo={editando ? 'Editar estudo' : 'Salvar estudo'}
      descricao={
        duracaoInicial
          ? `${ROTULO_ORIGEM[origem]}: ${formatarDuracao(duracaoInicial)} cronometrados. Diga o que você estudou.`
          : 'Registre o que você estudou.'
      }
    >
      {semDisciplinas ? (
        <div className="rounded-2xl bg-superficie-2 p-5 text-center">
          <p className="font-medium text-tinta">Você ainda não tem disciplinas.</p>
          <p className="mt-1 text-sm text-tinta-suave">Cadastre o edital primeiro para poder registrar estudos.</p>
          <Link to="/edital" onClick={() => aoMudar(false)} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria">
            Ir para o edital
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo rotulo="Disciplina" htmlFor="e-disciplina">
              <Selecao
                id="e-disciplina"
                value={disciplinaId}
                onChange={(e) => {
                  setDisciplinaId(e.target.value)
                  setTopicoId('')
                  setConcluir(false)
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
            <Campo rotulo="Tópico" htmlFor="e-topico">
              <Selecao id="e-topico" value={topicoId} onChange={(e) => escolherTopico(e.target.value)} disabled={!disciplinaId}>
                <option value="">{disciplinaId && topicosDaDisciplina.length === 0 ? 'Disciplina sem tópicos' : 'Escolha…'}</option>
                {topicosDaDisciplina.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.concluido ? '✓ ' : ''}
                    {t.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Campo rotulo="Quando" htmlFor="e-data">
              <Entrada id="e-data" type="datetime-local" required value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
            </Campo>
            <Campo rotulo="Tempo estudado">
              <div className="flex items-center gap-2">
                <Entrada type="number" inputMode="numeric" min={0} placeholder="0" aria-label="Horas" value={horas} onChange={(e) => setHoras(e.target.value)} className="numeros" />
                <span className="text-sm text-tinta-suave">h</span>
                <Entrada type="number" inputMode="numeric" min={0} max={59} placeholder="0" aria-label="Minutos" value={minutos} onChange={(e) => setMinutos(e.target.value)} className="numeros" />
                <span className="text-sm text-tinta-suave">min</span>
              </div>
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Questões feitas" htmlFor="e-feitas">
              <Entrada id="e-feitas" type="number" inputMode="numeric" min={0} placeholder="0" value={feitas} onChange={(e) => setFeitas(e.target.value)} className="numeros" />
            </Campo>
            <Campo rotulo="Acertos" htmlFor="e-acertos">
              <Entrada id="e-acertos" type="number" inputMode="numeric" min={0} placeholder="0" value={acertadas} onChange={(e) => setAcertadas(e.target.value)} className="numeros" />
            </Campo>
          </div>

          <Campo rotulo="Observação (opcional)" htmlFor="e-obs">
            <AreaTexto id="e-obs" rows={2} className="min-h-0" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: revisar súmulas, errei por falta de atenção…" />
          </Campo>

          {topicoSelecionado && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-superficie-2 px-3 py-3 text-[15px] text-tinta">
              <input type="checkbox" className="size-5" checked={concluir} onChange={(e) => setConcluir(e.target.checked)} />
              Marcar tópico como concluído no edital
            </label>
          )}

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
              {editando ? 'Salvar alterações' : 'Salvar estudo'}
            </Botao>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
