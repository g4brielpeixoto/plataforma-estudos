import { format, subDays } from 'date-fns'
import { CalendarDays, CircleCheck, Clock, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDisciplinas, useEstudos, useSalvarEstudo, useTopicos } from '@/hooks/dados'
import { categoriaDaLista, categoriasConhecidas, chaveCategoria, LIMITE_CATEGORIA } from '@/lib/categorias'
import { cn, formatarDuracaoExata, mensagemErro, porcentagem } from '@/lib/utils'
import type { Estudo, Origem } from '@/types'
import { SeletorTopico } from './SeletorTopico'
import { AreaTexto, Botao, Campo, Dialogo, Entrada, Interruptor, SeloAcerto, Selecao } from './ui'

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
const NOVA_CATEGORIA = '__nova__'

function lerCriarNovo() {
  try {
    return localStorage.getItem(CHAVE_CRIAR_NOVO) === '1'
  } catch {
    return false
  }
}
/*
  Tempo de estudo num campo só (hh:mm:ss). O que fica guardado enquanto se digita são os dígitos (até 6),
  que entram pela direita, como numa calculadora: 1, 2, 0, 7 → 00:12:07.
*/
const segundosDoTempo = (digitos: string) => {
  const d = digitos.padStart(6, '0')
  return Number(d.slice(0, 2)) * 3600 + Number(d.slice(2, 4)) * 60 + Number(d.slice(4, 6))
}
const digitosDoTempo = (segundos: number) => {
  const total = Math.min(Math.max(0, Math.round(segundos)), 99 * 3600 + 59 * 60 + 59)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${dois(Math.floor(total / 3600))}${dois(Math.floor((total % 3600) / 60))}${dois(total % 60)}`.replace(/^0+/, '')
}
const tempoFormatado = (digitos: string) => {
  const d = digitos.padStart(6, '0')
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4, 6)}`
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
  const estudos = useEstudos()
  const categorias = useMemo(() => categoriasConhecidas(estudos.data ?? []), [estudos.data])

  const [categoria, setCategoria] = useState('')
  // "Nova categoria": troca a lista por um campo para digitar o nome
  const [novaCategoria, setNovaCategoria] = useState(false)
  const refNovaCategoria = useRef<HTMLInputElement>(null)
  const [disciplinaId, setDisciplinaId] = useState('')
  const [topicoId, setTopicoId] = useState('')
  const [dataHora, setDataHora] = useState(paraLocal(new Date()))
  // tempo estudado como é digitado: até 6 dígitos (hhmmss), sem zeros à esquerda
  const [tempo, setTempo] = useState('')
  // "Outro" dia: mostra o campo de data e hora
  const [outroDia, setOutroDia] = useState(false)
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

  const preencherDuracao = (segundos: number) => setTempo(digitosDoTempo(segundos))

  // preenche o formulário ao abrir
  useEffect(() => {
    if (!aberto) return
    setErro('')
    setSalvosEmSequencia(0)
    setUltimoSalvo('')
    const todos = topicos.data ?? []
    setNovaCategoria(false)
    setOutroDia(false)
    setCategoria(editando?.categoria ?? '')
    if (editando) {
      const t = todos.find((x) => x.id === editando.topico_id)
      setDisciplinaId(editando.disciplina_id)
      setTopicoId(editando.topico_id ?? '')
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
  // flashcards costumam ser da disciplina inteira: nessa categoria o tópico é opcional
  // o dia pelos botões Hoje / Ontem / Outro; a hora continua a do campo (a de agora, num registro novo)
  const hojeTexto = format(new Date(), 'yyyy-MM-dd')
  const ontemTexto = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const diaEscolhido: 'hoje' | 'ontem' | 'outro' = outroDia ? 'outro' : dataHora.startsWith(hojeTexto) ? 'hoje' : dataHora.startsWith(ontemTexto) ? 'ontem' : 'outro'
  const escolherDia = (d: 'hoje' | 'ontem' | 'outro') => {
    setOutroDia(d === 'outro')
    if (d !== 'outro') setDataHora(`${d === 'hoje' ? hojeTexto : ontemTexto}T${dataHora.slice(11, 16) || format(new Date(), 'HH:mm')}`)
  }
  const qFeitasAgora = numero(feitas)
  const pctAgora = qFeitasAgora ? porcentagem(Math.min(numero(acertadas) ?? 0, qFeitasAgora), qFeitasAgora) : null
  const topicoOpcional = chaveCategoria(categoria) === chaveCategoria('Flashcards')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!disciplinaId) return setErro('Escolha a disciplina estudada.')
    if (!topicoId && !topicoOpcional) return setErro('Escolha o tópico estudado. Só a categoria Flashcards aceita estudo sem tópico.')
    const segundos = segundosDoTempo(tempo)
    const qFeitas = numero(feitas)
    const qAcertadas = numero(acertadas)
    if (!segundos && !qFeitas) return setErro('Informe o tempo estudado, as questões feitas ou os dois.')
    if (qAcertadas !== null && qFeitas === null) return setErro('Informe quantas questões você fez.')
    if (qAcertadas !== null && qFeitas !== null && qAcertadas > qFeitas) return setErro('Os acertos não podem passar do número de questões feitas.')

    try {
      await salvar.mutateAsync({
        id: editando?.id,
        estudo: {
          disciplina_id: disciplinaId,
          topico_id: topicoId || null,
          data_hora: new Date(dataHora).toISOString(),
          duracao_segundos: segundos || null,
          questoes_feitas: qFeitas || null,
          questoes_acertadas: qFeitas ? (qAcertadas ?? 0) : null,
          origem,
          observacao: observacao.trim() || null,
          categoria: categoriaDaLista(categoria, categorias),
        },
        concluirTopico: topicoSelecionado && topicoSelecionado.concluido !== concluir ? concluir : undefined,
        plannerItemId: editando || !primeiro ? undefined : iniciais?.plannerItemId,
      })
      const doPlanner = !editando && primeiro && iniciais?.plannerItemId
      toast.success(editando ? 'Estudo atualizado.' : doPlanner ? 'Estudo salvo e item do planner concluído.' : 'Estudo salvo.')
      aoSalvar?.()
      if (editando || !criarNovo) return aoMudar(false)

      // novo registro em branco: mantém a categoria, a disciplina e o dia, limpa o resto
      setCategoria(categoriaDaLista(categoria, categorias) ?? '')
      setNovaCategoria(false)
      const partes = [topicoSelecionado?.nome ?? (disciplinas.data ?? []).find((d) => d.id === disciplinaId)?.nome ?? 'Estudo']
      if (segundos) partes.push(formatarDuracaoExata(segundos))
      if (qFeitas) partes.push(`${qAcertadas ?? 0}/${qFeitas} questões`)
      setUltimoSalvo(partes.join(', '))
      setSalvosEmSequencia((n) => n + 1)
      setTopicoId('')
      setTempo('')
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
      largura="max-w-3xl"
      titulo={editando ? 'Editar estudo' : 'Salvar estudo'}
      descricao={
        (primeiro && duracaoInicial && origem !== 'manual'
          ? `${ROTULO_ORIGEM[origem]}: ${formatarDuracaoExata(duracaoInicial)} cronometrados. Diga o que você estudou.`
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
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="size-5 shrink-0 text-tinta-suave" aria-hidden />
            <div role="group" aria-label="Dia do estudo" className="inline-flex rounded-xl bg-superficie-2 p-1">
              {(['hoje', 'ontem', 'outro'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={diaEscolhido === d}
                  onClick={() => escolherDia(d)}
                  className={cn(
                    'h-9 rounded-lg px-4 text-sm font-semibold transition-colors',
                    diaEscolhido === d ? 'bg-primaria text-sobre-primaria shadow-sm' : 'text-tinta-suave hover:text-tinta',
                  )}
                >
                  {{ hoje: 'Hoje', ontem: 'Ontem', outro: 'Outro' }[d]}
                </button>
              ))}
            </div>
            {diaEscolhido === 'outro' && (
              <Entrada id="e-data" type="datetime-local" required aria-label="Dia e hora do estudo" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="w-auto min-w-0 flex-1 sm:max-w-64" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)]">
            <Campo rotulo="Categoria" htmlFor="e-categoria">
              {novaCategoria ? (
                <div className="flex items-center gap-1.5">
                  <Entrada
                    ref={refNovaCategoria}
                    id="e-categoria"
                    value={categoria}
                    maxLength={LIMITE_CATEGORIA}
                    placeholder="Nome da categoria"
                    onChange={(e) => setCategoria(e.target.value)}
                  />
                  <button
                    type="button"
                    title="Voltar para a lista de categorias"
                    aria-label="Voltar para a lista de categorias"
                    onClick={() => {
                      setNovaCategoria(false)
                      setCategoria('')
                    }}
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-tinta-suave hover:bg-superficie-2 hover:text-tinta"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <Selecao
                  id="e-categoria"
                  value={categoria}
                  onChange={(e) => {
                    if (e.target.value === NOVA_CATEGORIA) {
                      setNovaCategoria(true)
                      setCategoria('')
                      requestAnimationFrame(() => refNovaCategoria.current?.focus())
                    } else setCategoria(e.target.value)
                  }}
                >
                  <option value="">Escolha…</option>
                  {/* categoria de um registro antigo que saiu da lista continua aparecendo */}
                  {[...categorias, ...(categoria && !categorias.includes(categoria) ? [categoria] : [])].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={NOVA_CATEGORIA}>Nova categoria…</option>
                </Selecao>
              )}
            </Campo>
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
            <Campo rotulo="Tempo de estudo" htmlFor="e-tempo">
              <div className="relative">
                <Clock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
                <Entrada
                  id="e-tempo"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-describedby="e-tempo-dica"
                  value={tempoFormatado(tempo)}
                  onChange={(e) => setTempo(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(-6))}
                  onBlur={() => setTempo((d) => digitosDoTempo(segundosDoTempo(d)))}
                  // o cursor fica sempre no fim (os dígitos entram pela direita); selecionar tudo continua valendo
                  onSelect={(e) => {
                    const campo = e.currentTarget
                    const fim = campo.value.length
                    const tudo = campo.selectionStart === 0 && campo.selectionEnd === fim
                    if (!tudo && (campo.selectionStart !== fim || campo.selectionEnd !== fim)) campo.setSelectionRange(fim, fim)
                  }}
                  className="numeros pl-9"
                />
                <span id="e-tempo-dica" className="sr-only">
                  Horas, minutos e segundos. Digite só os números: eles entram pela direita.
                </span>
              </div>
            </Campo>
          </div>

          <Campo rotulo={topicoOpcional ? 'Tópico (opcional)' : 'Tópico'} htmlFor="e-topico">
              <SeletorTopico
                ref={refTopico}
                id="e-topico"
                topicos={topicos.data ?? []}
                disciplinas={disciplinas.data ?? []}
                disciplinaId={disciplinaId}
                valor={topicoId}
                opcaoVazia={topicoOpcional ? 'Sem tópico' : undefined}
                aoEscolher={(t) => {
                  if (!t) {
                    // "Sem tópico" (só aparece na categoria Flashcards)
                    setTopicoId('')
                    setConcluir(false)
                    return
                  }
                  setDisciplinaId(t.disciplina_id)
                  setTopicoId(t.id)
                  setConcluir(t.concluido)
                }}
                placeholder={topicoOpcional ? 'Sem tópico' : disciplinaId && topicosDaDisciplina.length === 0 ? 'Disciplina sem tópicos' : 'Escolha ou busque…'}
              />
            </Campo>

          <fieldset className="rounded-2xl border border-linha px-4 pt-3 pb-4">
            <legend className="sr-only">Questões</legend>
            <p className="text-sm font-medium text-tinta" aria-hidden>
              Questões <span className="font-normal text-tinta-suave italic">(opcional)</span>
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="block w-28 space-y-1 text-sm text-tinta-suave">
                Feitas
                <Entrada id="e-feitas" type="number" inputMode="numeric" min={0} placeholder="0" value={feitas} onChange={(e) => setFeitas(e.target.value)} className="numeros text-center" />
              </label>
              <label className="block w-28 space-y-1 text-sm text-tinta-suave">
                Acertos
                <Entrada id="e-acertos" type="number" inputMode="numeric" min={0} placeholder="0" value={acertadas} onChange={(e) => setAcertadas(e.target.value)} className="numeros text-center" />
              </label>
              {pctAgora !== null && <SeloAcerto pct={pctAgora} className="mb-2" />}
            </div>
          </fieldset>

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {!editando && (
              <Interruptor
                ligado={criarNovo}
                aoMudar={alternarCriarNovo}
                rotulo="Salvar e criar novo"
                descricao="Abre outro registro em seguida, com a mesma categoria, disciplina e dia."
              />
            )}
            <div className="flex flex-wrap justify-end gap-2 sm:ml-auto sm:shrink-0">
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
          </div>
        </form>
      )}
    </Dialogo>
  )
}
