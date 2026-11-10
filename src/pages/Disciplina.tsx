import { ArrowLeft, FileUp, ListChecks, Pencil, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { DisciplinaDialog } from '@/components/DisciplinaDialog'
import { ImportarDialog } from '@/components/ImportarDialog'
import { ListaTopicos } from '@/components/ListaTopicos'
import { BarraProgresso, Botao, Carregando, Confirmar, Dialogo, Entrada, Painel, Vazio } from '@/components/ui'
import { useDisciplinas, useEstudos, useExcluirTopico, useReordenarTopicos, useSalvarTopico, useTopicos } from '@/hooks/dados'
import { calcularIndicadores, resumirPorTopico } from '@/lib/indicadores'
import { filhosDe } from '@/lib/topicos'
import { cn, formatarDuracao, mensagemErro, normalizar } from '@/lib/utils'
import type { Topico } from '@/types'

type Filtro = 'todos' | 'pendentes' | 'concluidos'

export function Disciplina() {
  const { id } = useParams()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const estudos = useEstudos()
  const salvarTopico = useSalvarTopico()
  const reordenar = useReordenarTopicos()
  const excluirTopico = useExcluirTopico()

  const [novo, setNovo] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [importando, setImportando] = useState(false)
  const [editandoDisciplina, setEditandoDisciplina] = useState(false)
  const [excluindo, setExcluindo] = useState<Topico | null>(null)
  const [subDe, setSubDe] = useState<Topico | null>(null)
  const [nomeSub, setNomeSub] = useState('')

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

  const filhosExcluindo = excluindo && excluindo.nivel === 0 ? filhosDe(meus, excluindo.id) : []

  /** Cria o subtópico logo depois do último subtópico do pai, numa única gravação */
  const adicionarSubtopico = (e: FormEvent) => {
    e.preventDefault()
    const nome = nomeSub.trim()
    if (!nome || !subDe) return
    if (meus.some((t) => normalizar(t.nome) === normalizar(nome))) return toast.error('Já existe um tópico com esse nome.')
    const novoTopico: Topico = {
      id: crypto.randomUUID(),
      user_id: subDe.user_id,
      disciplina_id: subDe.disciplina_id,
      nome,
      ordem: 0,
      nivel: 1,
      concluido: false,
      concluido_em: null,
      criado_em: new Date().toISOString(),
    }
    const irmaos = filhosDe(meus, subDe.id)
    const depoisDe = irmaos.length ? irmaos[irmaos.length - 1].id : subDe.id
    const i = meus.findIndex((t) => t.id === depoisDe)
    const nova = [...meus.slice(0, i + 1), novoTopico, ...meus.slice(i + 1)]
    reordenar.mutate(nova, {
      onSuccess: () => setSubDe(null),
      onError: (err) => toast.error(mensagemErro(err)),
    })
  }

  const renomear = async (t: Topico, nome: string) => {
    try {
      await salvarTopico.mutateAsync({ id: t.id, nome })
      return true
    } catch (err) {
      toast.error(mensagemErro(err))
      return false
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluirTopico.mutateAsync([excluindo.id, ...filhosExcluindo.map((f) => f.id)])
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
        {meus.length > 1 && (
          <p className="px-5 pt-2 text-sm text-tinta-suave">
            {filtro === 'todos'
              ? 'Arraste pela alça ou toque no número para mudar a ordem. Subtópicos ficam no menu ⋮ de cada tópico.'
              : 'Toque no número para mudar a ordem. Para arrastar, volte para Todos.'}
          </p>
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
          <ListaTopicos
            topicos={meus}
            visiveis={visiveis}
            porTopico={porTopico}
            podeArrastar={filtro === 'todos'}
            aoReordenar={(nova) => reordenar.mutate(nova, { onError: (e) => toast.error(mensagemErro(e)) })}
            aoAlternarConcluido={alternarConcluido}
            aoRenomear={renomear}
            aoExcluir={setExcluindo}
            aoAdicionarSubtopico={(pai) => {
              setNomeSub('')
              setSubDe(pai)
            }}
          />
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
      <Dialogo aberto={!!subDe} aoMudar={(a) => !a && setSubDe(null)} titulo="Novo subtópico" descricao={subDe ? `Dentro de "${subDe.nome}"` : undefined} largura="max-w-md">
        <form onSubmit={adicionarSubtopico} className="space-y-4">
          <Entrada autoFocus value={nomeSub} onChange={(e) => setNomeSub(e.target.value)} placeholder="Ex.: Jornada de trabalho 2" aria-label="Nome do subtópico" />
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setSubDe(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={reordenar.isPending}>
              Adicionar subtópico
            </Botao>
          </div>
        </form>
      </Dialogo>
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo={excluindo?.nivel === 1 ? 'Excluir subtópico?' : 'Excluir tópico?'}
        texto={
          filhosExcluindo.length
            ? `"${excluindo?.nome ?? ''}", os ${filhosExcluindo.length === 1 ? 'seu subtópico' : `seus ${filhosExcluindo.length} subtópicos`} e os estudos registrados neles serão excluídos. Isso não pode ser desfeito.`
            : `"${excluindo?.nome ?? ''}" e os estudos registrados nele serão excluídos. Isso não pode ser desfeito.`
        }
        textoBotao="Excluir tópico"
        carregando={excluirTopico.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </>
  )
}
