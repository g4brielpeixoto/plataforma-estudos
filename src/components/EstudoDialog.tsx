import { format } from 'date-fns'
import { CircleCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDisciplinas, useSalvarEstudo, useTopicos } from '@/hooks/dados'
import { cn, formatarDuracao, mensagemErro } from '@/lib/utils'
import type { Estudo, Origem } from '@/types'
import { SeletorTopico } from './SeletorTopico'
import { AreaTexto, Botao, Campo, Dialogo, Entrada, Interruptor, Selecao } from './ui'

export interface ValoresIniciaisEstudo {
  duracaoSegundos?: number
  origem?: Origem
  disciplinaId?: string
  topicoId?: string
  /** item do planner que fica concluído (e ligado a este estudo) ao salvar */
  plannerItemId?: string
}

const ROTULO_ORIGEM: Record<Origem, string> = {
  manual: 'Lançamento manual',
  cronometro: 'Cronômetro',
  timer: 'Timer',
  pomodoro: 'Pomodoro',
}

const paraLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")
const CHAVE_CRIAR_NOVO = 'estudo:criar-novo'
const LIMITE_OBSERVACAO = 500

function lerCriarNovo() {
  try {
    return localStorage.getItem(CHAVE_CRIAR_NOVO) === '1'
  } catch {
    return false
  }
}
const numero = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))))

export function EstudoDialog({
  aberto,
  aoMudar,
  editando,
  iniciais,
  aoSalvar,
  aoSoConcluir,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  editando?: Estudo | null
  iniciais?: ValoresIniciaisEstudo
  aoSalvar?: () => void
  /** mostra a opção de marcar o item do planner como feito sem registrar estudo */
  aoSoConcluir?: () => void
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
  // "Salvar e criar novo": depois de salvar, o diálogo continua aberto com um registro em branco
  const [criarNovo, setCriarNovo] = useState(lerCriarNovo)
  const [salvosEmSequencia, setSalvosEmSequencia] = useState(0)
  const [ultimoSalvo, setUltimoSalvo] = useState('')
  const refTopico = useRef<HTMLButtonElement>(null)
  // os valores iniciais (tempo do cronômetro, item do planner) valem só para o primeiro registro
  const primeiro = salvosEmSequencia === 0

  const alternarCriarNovo = (v: boolean) => {
    setCriarNovo(v)
    try {
      localStorage.setItem(CHAVE_CRIAR_NOVO, v ? '1' : '0')
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }

  const preencherDuracao = (segundos: number) => {
    const totalMin = Math.round(segundos / 60)
    setHoras(totalMin >= 60 ? String(Math.floor(totalMin / 60)) : '')
    setMinutos(totalMin ? String(totalMin % 60) : '')
  }

  // preenche o formulário ao abrir
  useEffect(() => {
    if (!aberto) return
    setErro('')
    setSalvosEmSequencia(0)
    setUltimoSalvo('')
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
        plannerItemId: editando || !primeiro ? undefined : iniciais?.plannerItemId,
      })
      const doPlanner = !editando && primeiro && iniciais?.plannerItemId
      toast.success(editando ? 'Estudo atualizado.' : doPlanner ? 'Estudo salvo e item do planner concluído.' : 'Estudo salvo.')
      aoSalvar?.()
      if (editando || !criarNovo) return aoMudar(false)

      // novo registro em branco: mantém a disciplina e o dia, limpa o resto
      const partes = [topicoSelecionado?.nome ?? 'Estudo']
      if (segundos) partes.push(formatarDuracao(segundos))
      if (qFeitas) partes.push(`${qAcertadas ?? 0}/${qFeitas} questões`)
      setUltimoSalvo(partes.join(', '))
      setSalvosEmSequencia((n) => n + 1)
      setTopicoId('')
      setHoras('')
      setMinutos('')
      setFeitas('')
      setAcertadas('')
      setObservacao('')
      setConcluir(false)
      setOrigem('manual')
      // volta ao topo (onde aparece o aviso de salvo) e deixa o cursor no tópico
      requestAnimationFrame(() => {
        refTopico.current?.closest('[role="dialog"]')?.scrollTo({ top: 0 })
        refTopico.current?.focus({ preventScroll: true })
      })
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
        (primeiro && duracaoInicial && origem !== 'manual'
          ? `${ROTULO_ORIGEM[origem]}: ${formatarDuracao(duracaoInicial)} cronometrados. Diga o que você estudou.`
          : 'Registre o que você estudou.') + (!editando && primeiro && iniciais?.plannerItemId ? ' Ao salvar, o item do planner fica marcado como feito.' : '')
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
          {ultimoSalvo && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-bom-fundo px-3 py-2.5 text-sm text-tinta">
              <CircleCheck className="mt-px size-4 shrink-0 text-bom" aria-hidden />
              <span className="min-w-0">
                <strong className="font-semibold">{salvosEmSequencia === 1 ? 'Estudo salvo' : `${salvosEmSequencia} estudos salvos`}:</strong> {ultimoSalvo}. Agora registre o próximo.
              </span>
            </p>
          )}
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
              <SeletorTopico
                ref={refTopico}
                id="e-topico"
                topicos={topicos.data ?? []}
                disciplinas={disciplinas.data ?? []}
                disciplinaId={disciplinaId}
                valor={topicoId}
                aoEscolher={(t) => {
                  if (!t) return
                  setDisciplinaId(t.disciplina_id)
                  setTopicoId(t.id)
                  setConcluir(t.concluido)
                }}
                placeholder={disciplinaId && topicosDaDisciplina.length === 0 ? 'Disciplina sem tópicos' : 'Escolha ou busque…'}
              />
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
            <div className="relative">
              <AreaTexto
                id="e-obs"
                rows={2}
                maxLength={LIMITE_OBSERVACAO}
                className="min-h-0 pb-6"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: revisar súmulas, errei por falta de atenção…"
              />
              <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-tinta-suave numeros" aria-hidden>
                {observacao.length}/{LIMITE_OBSERVACAO}
              </span>
            </div>
          </Campo>

          {topicoSelecionado && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-superficie-2 px-3 py-3 text-[15px] text-tinta">
              <input type="checkbox" className="visto size-5" checked={concluir} onChange={(e) => setConcluir(e.target.checked)} />
              Marcar tópico como concluído no edital
            </label>
          )}

          {erro && (
            <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
              {erro}
            </p>
          )}

          <div className="-mx-5 border-t border-linha/70 px-5 pt-4 sm:-mx-6 sm:px-6">
            {!editando && (
              <Interruptor
                ligado={criarNovo}
                aoMudar={alternarCriarNovo}
                rotulo="Salvar e criar novo"
                descricao="Salva este registro e abre um novo em seguida, com a mesma disciplina e o mesmo dia."
              />
            )}
            <div className={cn('flex flex-wrap justify-end gap-2', !editando && 'mt-4')}>
              {aoSoConcluir && !editando && primeiro && (
                <Botao
                  type="button"
                  variante="fantasma"
                  className="mr-auto px-2"
                  title="Para quando o estudo já foi registrado de outro jeito"
                  onClick={() => {
                    aoSoConcluir()
                    aoMudar(false)
                  }}
                >
                  Só marcar como feito
                </Botao>
              )}
              <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
                {salvosEmSequencia > 0 ? 'Fechar' : 'Cancelar'}
              </Botao>
              <Botao type="submit" carregando={salvar.isPending}>
                {editando ? 'Salvar alterações' : 'Salvar estudo'}
              </Botao>
            </div>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
