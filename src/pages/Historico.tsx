import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, History, Pencil, Plus, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EstudoDialog } from '@/components/EstudoDialog'
import { FiltroPeriodo, PainelIndicadores } from '@/components/Indicadores'
import { Botao, CabecalhoPagina, Carregando, Confirmar, Painel, SeloAcerto, Selecao, Vazio } from '@/components/ui'
import { useDisciplinas, useEstudos, useExcluirEstudo, useTopicos } from '@/hooks/dados'
import { calcularIndicadores, filtrarPorPeriodo, type Periodo } from '@/lib/indicadores'
import { cn, formatarDuracao, mensagemErro, porcentagem } from '@/lib/utils'
import type { Estudo } from '@/types'
import { rotuloSelecao } from '@/lib/topicos'

/** Questões, tempo e horário de um estudo */
function Numeros({ estudo: e, className }: { estudo: Estudo; className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-3 text-sm numeros sm:gap-4', className)}>
      {e.questoes_feitas ? (
        <span className="inline-flex items-center gap-1.5 text-tinta">
          {e.questoes_acertadas ?? 0}/{e.questoes_feitas}
          <SeloAcerto pct={porcentagem(e.questoes_acertadas ?? 0, e.questoes_feitas)} />
        </span>
      ) : null}
      {e.duracao_segundos ? (
        <span className="inline-flex items-center gap-1 text-tinta-suave">
          {e.origem === 'manual' ? <Clock className="size-3.5" aria-hidden /> : <Timer className="size-3.5" aria-label="Cronometrado" />}
          {formatarDuracao(e.duracao_segundos)}
        </span>
      ) : null}
      <span className="text-tinta-suave">{format(new Date(e.data_hora), 'HH:mm')}</span>
    </div>
  )
}

function rotuloDia(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  const texto = format(d, "EEEE, d 'de' MMMM", { locale: ptBR })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function Historico() {
  const estudos = useEstudos()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const excluir = useExcluirEstudo()

  const [periodo, setPeriodo] = useState<Periodo>({ preset: '30d' })
  const [disciplinaId, setDisciplinaId] = useState('')
  const [topicoId, setTopicoId] = useState('')
  const [dialogo, setDialogo] = useState<{ aberto: boolean; editando: Estudo | null }>({ aberto: false, editando: null })
  const [excluindo, setExcluindo] = useState<Estudo | null>(null)

  const topicosPorId = useMemo(() => new Map((topicos.data ?? []).map((t) => [t.id, t])), [topicos.data])
  const disciplinasPorId = useMemo(() => new Map((disciplinas.data ?? []).map((d) => [d.id, d])), [disciplinas.data])
  const topicosDaDisciplina = (topicos.data ?? []).filter((t) => t.disciplina_id === disciplinaId)

  const filtrados = useMemo(() => {
    let lista = filtrarPorPeriodo(estudos.data ?? [], periodo)
    if (topicoId) lista = lista.filter((e) => e.topico_id === topicoId)
    else if (disciplinaId) lista = lista.filter((e) => e.disciplina_id === disciplinaId)
    return lista
  }, [estudos.data, periodo, disciplinaId, topicoId, topicosPorId])

  const topicosConsiderados = disciplinaId ? topicosDaDisciplina : (topicos.data ?? [])
  const ind = calcularIndicadores(filtrados, topicoId ? topicosConsiderados.filter((t) => t.id === topicoId) : topicosConsiderados)

  const grupos = useMemo(() => {
    const mapa = new Map<string, Estudo[]>()
    for (const e of filtrados) {
      const dia = format(new Date(e.data_hora), 'yyyy-MM-dd')
      mapa.set(dia, [...(mapa.get(dia) ?? []), e])
    }
    return [...mapa.entries()]
  }, [filtrados])

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluir.mutateAsync(excluindo.id)
      toast.success('Estudo excluído.')
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  const carregando = estudos.isLoading || topicos.isLoading || disciplinas.isLoading

  return (
    <>
      <CabecalhoPagina
        titulo="Histórico"
        subtitulo="Tudo o que você estudou, dia a dia."
        acoes={
          <Botao onClick={() => setDialogo({ aberto: true, editando: null })}>
            <Plus className="size-4" aria-hidden /> Adicionar estudo
          </Botao>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} />
        <div className="flex flex-wrap gap-2">
          <Selecao
            aria-label="Filtrar por disciplina"
            className="h-9 w-auto min-w-44 text-sm"
            value={disciplinaId}
            onChange={(e) => {
              setDisciplinaId(e.target.value)
              setTopicoId('')
            }}
          >
            <option value="">Todas as disciplinas</option>
            {(disciplinas.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </Selecao>
          {disciplinaId && (
            <Selecao aria-label="Filtrar por tópico" className="h-9 w-auto min-w-44 max-w-72 text-sm" value={topicoId} onChange={(e) => setTopicoId(e.target.value)}>
              <option value="">Todos os tópicos</option>
              {topicosDaDisciplina.map((t) => (
                <option key={t.id} value={t.id}>
                  {rotuloSelecao(t, topicos.data ?? [])}
                </option>
              ))}
            </Selecao>
          )}
        </div>
      </div>

      {carregando ? (
        <Carregando />
      ) : (
        <>
          <PainelIndicadores dados={ind} className="mb-6" />

          {grupos.length === 0 ? (
            <Painel>
              <Vazio
                icone={<History className="size-9" />}
                titulo="Nenhum estudo neste período"
                texto="Use o cronômetro na aba Estudar ou registre um estudo manualmente."
                acao={
                  <Botao onClick={() => setDialogo({ aberto: true, editando: null })}>
                    <Plus className="size-4" aria-hidden /> Adicionar estudo
                  </Botao>
                }
              />
            </Painel>
          ) : (
            <div className="space-y-6">
              {grupos.map(([dia, lista]) => {
                const tempoDia = lista.reduce((s, e) => s + (e.duracao_segundos ?? 0), 0)
                return (
                  <section key={dia}>
                    <div className="mb-2 flex items-baseline justify-between px-1">
                      <h2 className="font-semibold text-tinta">{rotuloDia(lista[0].data_hora)}</h2>
                      {tempoDia > 0 && <span className="text-sm text-tinta-suave numeros">{formatarDuracao(tempoDia)}</span>}
                    </div>
                    <Painel>
                      <ul className="divide-y divide-linha/60">
                        {lista.map((e) => {
                          const t = e.topico_id ? topicosPorId.get(e.topico_id) : undefined
                          const d = disciplinasPorId.get(e.disciplina_id)
                          return (
                            <li key={e.id} className="group flex items-center gap-3 px-4 py-3 sm:px-5">
                              <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: d?.cor ?? 'var(--c-lilas)' }} aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-tinta">{d?.nome ?? 'Disciplina excluída'}</p>
                                <p className="truncate text-sm text-tinta-suave">
                                  {e.categoria && <span className="mr-1.5 inline-block rounded-md bg-nevoa px-1.5 py-px text-xs font-medium text-tinta">{e.categoria}</span>}
                                  {t?.nome ?? (e.topico_id ? '—' : 'Sem tópico')}
                                </p>
                                {e.observacao && <p className="mt-0.5 line-clamp-2 text-sm text-tinta-suave italic">{e.observacao}</p>}
                                <Numeros estudo={e} className="mt-1.5 sm:hidden" />
                              </div>
                              <Numeros estudo={e} className="hidden sm:flex" />
                              <div className="flex shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                                <Botao variante="fantasma" tamanho="icone" aria-label="Editar estudo" onClick={() => setDialogo({ aberto: true, editando: e })}>
                                  <Pencil className="size-4" />
                                </Botao>
                                <Botao variante="fantasma" tamanho="icone" aria-label="Excluir estudo" onClick={() => setExcluindo(e)}>
                                  <Trash2 className="size-4" />
                                </Botao>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </Painel>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      <EstudoDialog aberto={dialogo.aberto} aoMudar={(a) => setDialogo((s) => ({ ...s, aberto: a }))} editando={dialogo.editando} />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir estudo?"
        texto="Este registro sai do histórico e dos indicadores. Isso não pode ser desfeito."
        textoBotao="Excluir estudo"
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </>
  )
}
