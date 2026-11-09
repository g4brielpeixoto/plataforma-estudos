import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, ChevronDown, ChevronUp, FileUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { DisciplinaDialog } from '@/components/DisciplinaDialog'
import { ImportarDialog } from '@/components/ImportarDialog'
import { BarraProgresso, Botao, Carregando, Confirmar, Entrada, Painel, SeloAcerto, Vazio } from '@/components/ui'
import { useDisciplinas, useEstudos, useExcluirTopico, useSalvarTopico, useTopicos, useTrocarOrdemTopicos } from '@/hooks/dados'
import { calcularIndicadores, resumirPorTopico } from '@/lib/indicadores'
import { cn, formatarDuracao, mensagemErro, normalizar } from '@/lib/utils'
import type { Topico } from '@/types'

type Filtro = 'todos' | 'pendentes' | 'concluidos'

export function Disciplina() {
  const { id } = useParams()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const estudos = useEstudos()
  const salvarTopico = useSalvarTopico()
  const trocarOrdem = useTrocarOrdemTopicos()
  const excluirTopico = useExcluirTopico()

  const [novo, setNovo] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [importando, setImportando] = useState(false)
  const [editandoDisciplina, setEditandoDisciplina] = useState(false)
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null)
  const [excluindo, setExcluindo] = useState<Topico | null>(null)

  const disciplina = disciplinas.data?.find((d) => d.id === id)
  const meus = useMemo(() => (topicos.data ?? []).filter((t) => t.disciplina_id === id), [topicos.data, id])
  const idsMeus = useMemo(() => new Set(meus.map((t) => t.id)), [meus])
  const estudosMeus = useMemo(() => (estudos.data ?? []).filter((e) => idsMeus.has(e.topico_id)), [estudos.data, idsMeus])
  const porTopico = useMemo(() => resumirPorTopico(estudosMeus), [estudosMeus])
  const ind = calcularIndicadores(estudosMeus, meus)

  if (disciplinas.isLoading || topicos.isLoading) return <Carregando />
  if (!disciplina)
    return (
      <Painel>
        <Vazio titulo="Disciplina não encontrada" texto="Ela pode ter sido excluída." acao={<Link to="/edital" className="font-semibold text-primaria-forte">Voltar para o edital</Link>} />
      </Painel>
    )

  const visiveis = meus.filter((t) => (filtro === 'todos' ? true : filtro === 'pendentes' ? !t.concluido : t.concluido))

  const adicionar = async (e: FormEvent) => {
    e.preventDefault()
    const nome = novo.trim()
    if (!nome) return
    if (meus.some((t) => normalizar(t.nome) === normalizar(nome))) return toast.error('Já existe um tópico com esse nome.')
    try {
      await salvarTopico.mutateAsync({ disciplina_id: disciplina.id, nome, ordem: meus.reduce((m, t) => Math.max(m, t.ordem), -1) + 1 })
      setNovo('')
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  const alternarConcluido = (t: Topico) =>
    salvarTopico.mutate({ id: t.id, concluido: !t.concluido }, { onError: (e) => toast.error(mensagemErro(e)) })

  const mover = (t: Topico, direcao: -1 | 1) => {
    const i = meus.findIndex((x) => x.id === t.id)
    const outro = meus[i + direcao]
    if (!outro) return
    // se as ordens forem iguais (ex.: importação antiga), usa a posição na lista
    const a = { ...t, ordem: t.ordem === outro.ordem ? i : t.ordem }
    const b = { ...outro, ordem: t.ordem === outro.ordem ? i + direcao : outro.ordem }
    trocarOrdem.mutate([a, b], { onError: (e) => toast.error(mensagemErro(e)) })
  }

  const salvarNome = async (e: FormEvent) => {
    e.preventDefault()
    if (!renomeando?.nome.trim()) return
    try {
      await salvarTopico.mutateAsync({ id: renomeando.id, nome: renomeando.nome })
      setRenomeando(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluirTopico.mutateAsync(excluindo.id)
      toast.success('Tópico excluído.')
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <>
      <Link to="/edital" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden /> Edital
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-2 size-3.5 shrink-0 rounded-full" style={{ background: disciplina.cor }} aria-hidden />
          <div className="min-w-0">
            <h1 className="font-serif text-[1.85rem] leading-tight font-medium tracking-[-0.01em] text-tinta">{disciplina.nome}</h1>
            <p className="mt-1 text-tinta-suave numeros">
              {formatarDuracao(ind.tempoSegundos)} estudados · {ind.questoesFeitas} questões
              {ind.acertoPct !== null && ` · ${ind.acertoPct}% de acerto`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => setEditandoDisciplina(true)}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Botao>
          <Botao variante="secundario" onClick={() => setImportando(true)}>
            <FileUp className="size-4" aria-hidden /> Importar tópicos
          </Botao>
        </div>
      </header>

      <Painel className="mb-5 p-5">
        <div className="flex items-baseline justify-between text-sm numeros">
          <span className="font-medium text-tinta">Progresso</span>
          <span className="whitespace-nowrap text-tinta-suave">
            <strong className="text-tinta">{ind.progressoPct ?? 0}%</strong> · {ind.topicosConcluidos} de {ind.topicosTotal} concluídos
          </span>
        </div>
        <BarraProgresso valor={ind.progressoPct} cor={disciplina.cor} className="mt-2 h-2.5" rotulo="Progresso nesta disciplina" />
      </Painel>

      <Painel>
        <form onSubmit={adicionar} className="flex gap-2 border-b border-linha/70 p-4">
          <Entrada value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo tópico" aria-label="Novo tópico" />
          <Botao type="submit" carregando={salvarTopico.isPending && !!novo} className="shrink-0">
            <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Adicionar</span>
          </Botao>
        </form>

        {meus.length > 0 && (
          <div role="radiogroup" aria-label="Filtrar tópicos" className="flex gap-1 overflow-x-auto px-4 pt-3">
            {(['todos', 'pendentes', 'concluidos'] as Filtro[]).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium', filtro === f ? 'bg-nevoa text-tinta' : 'text-tinta-suave hover:text-tinta')}
              >
                {f === 'todos' ? `Todos (${meus.length})` : f === 'pendentes' ? `Pendentes (${ind.topicosPendentes})` : `Concluídos (${ind.topicosConcluidos})`}
              </button>
            ))}
          </div>
        )}

        {meus.length === 0 ? (
          <Vazio
            icone={<ListChecks className="size-9" />}
            titulo="Nenhum tópico ainda"
            texto="Digite os tópicos acima um por um, ou cole a lista inteira com a importação."
            acao={
              <Botao variante="secundario" onClick={() => setImportando(true)}>
                <FileUp className="size-4" aria-hidden /> Importar tópicos
              </Botao>
            }
          />
        ) : visiveis.length === 0 ? (
          <p className="px-4 py-10 text-center text-tinta-suave">Nenhum tópico neste filtro.</p>
        ) : (
          <ul className="divide-y divide-linha/60 p-2">
            {visiveis.map((t) => {
              const r = porTopico.get(t.id)
              const indice = meus.findIndex((x) => x.id === t.id)
              return (
                <li key={t.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-superficie-2/70">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer"
                    checked={t.concluido}
                    onChange={() => alternarConcluido(t)}
                    aria-label={t.concluido ? `Desmarcar ${t.nome}` : `Marcar ${t.nome} como concluído`}
                  />
                  <div className="min-w-0 flex-1">
                    {renomeando?.id === t.id ? (
                      <form onSubmit={salvarNome} className="flex gap-2">
                        <Entrada
                          autoFocus
                          className="h-9"
                          value={renomeando.nome}
                          onChange={(e) => setRenomeando({ id: t.id, nome: e.target.value })}
                          onKeyDown={(e) => e.key === 'Escape' && setRenomeando(null)}
                          aria-label="Nome do tópico"
                        />
                        <Botao type="submit" tamanho="sm">
                          Salvar
                        </Botao>
                      </form>
                    ) : (
                      <>
                        <p className={cn('text-[15px] leading-snug', t.concluido ? 'text-tinta-suave line-through decoration-lilas' : 'text-tinta')}>{t.nome}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave numeros">
                          {r ? (
                            <>
                              {r.tempoSegundos > 0 && <span>{formatarDuracao(r.tempoSegundos)}</span>}
                              {r.questoesFeitas > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  {r.questoesAcertadas}/{r.questoesFeitas} <SeloAcerto pct={r.acertoPct} className="px-1 py-0 text-xs" />
                                </span>
                              )}
                              {r.ultimoEstudo && <span>há {formatDistanceToNowStrict(new Date(r.ultimoEstudo), { locale: ptBR })}</span>}
                            </>
                          ) : (
                            <span>Ainda não estudado</span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                  {renomeando?.id !== t.id && (
                    <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                      <Botao variante="fantasma" tamanho="icone" aria-label="Subir" disabled={indice === 0 || filtro !== 'todos'} onClick={() => mover(t, -1)} className="hidden sm:inline-flex">
                        <ChevronUp className="size-4" />
                      </Botao>
                      <Botao variante="fantasma" tamanho="icone" aria-label="Descer" disabled={indice === meus.length - 1 || filtro !== 'todos'} onClick={() => mover(t, 1)} className="hidden sm:inline-flex">
                        <ChevronDown className="size-4" />
                      </Botao>
                      <Botao variante="fantasma" tamanho="icone" aria-label={`Renomear ${t.nome}`} onClick={() => setRenomeando({ id: t.id, nome: t.nome })}>
                        <Pencil className="size-4" />
                      </Botao>
                      <Botao variante="fantasma" tamanho="icone" aria-label={`Excluir ${t.nome}`} onClick={() => setExcluindo(t)}>
                        <Trash2 className="size-4" />
                      </Botao>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Painel>

      <ImportarDialog aberto={importando} aoMudar={setImportando} modo="topicos" disciplina={disciplina} disciplinas={disciplinas.data ?? []} topicos={topicos.data ?? []} />
      <DisciplinaDialog
        aberto={editandoDisciplina}
        aoMudar={setEditandoDisciplina}
        editando={disciplina}
        proximaOrdem={0}
        coresUsadas={(disciplinas.data ?? []).map((d) => d.cor)}
      />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir tópico?"
        texto={`"${excluindo?.nome ?? ''}" e os estudos registrados nele serão excluídos. Isso não pode ser desfeito.`}
        textoBotao="Excluir tópico"
        carregando={excluirTopico.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </>
  )
}
