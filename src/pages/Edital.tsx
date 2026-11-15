import { ArrowDownAZ, ArrowRight, BookOpen, ChevronDown, ChevronsDownUp, ChevronsUpDown, FileUp, Filter, Pencil, Plus, Scale, Trash2, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { DisciplinaDialog } from '@/components/DisciplinaDialog'
import { ImportarDialog } from '@/components/ImportarDialog'
import { BarraProgresso, Botao, CabecalhoPagina, Carregando, Confirmar, Painel, Selecao, SeloAcerto, Vazio } from '@/components/ui'
import { useDisciplinas, useEstudos, useExcluirDisciplina, useSalvarTopico, useTopicos } from '@/hooks/dados'
import { resumirPorTopico, somarResumos } from '@/lib/indicadores'
import { descendentesDe, numeracao } from '@/lib/topicos'
import { cn, mensagemErro, porcentagem } from '@/lib/utils'
import type { Disciplina, Topico } from '@/types'

type Ordem = 'edital' | 'nome' | 'progresso' | 'acerto'
type Mostrar = 'todas' | 'andamento' | 'concluidas' | 'nao_iniciadas'
const ORDENS: Record<Ordem, string> = { edital: 'Ordem do edital', nome: 'Nome', progresso: 'Maior progresso', acerto: 'Menor acerto' }
const MOSTRAR: Record<Mostrar, string> = { todas: 'Todas', andamento: 'Em andamento', concluidas: 'Concluídas', nao_iniciadas: 'Não iniciadas' }

/** Preferência simples guardada no navegador (ordem e filtro da lista) */
function usePreferencia<T extends string>(chave: string, validos: readonly T[], padrao: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const v = localStorage.getItem(chave) as T | null
      return v && validos.includes(v) ? v : padrao
    } catch {
      return padrao
    }
  })
  const mudar = (v: T) => {
    setValor(v)
    try {
      localStorage.setItem(chave, v)
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }
  return [valor, mudar] as const
}

export function Edital() {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const estudos = useEstudos()
  const excluir = useExcluirDisciplina()
  const [dialogo, setDialogo] = useState<{ aberto: boolean; editando: Disciplina | null }>({ aberto: false, editando: null })
  const [importando, setImportando] = useState(false)
  const [excluindo, setExcluindo] = useState<Disciplina | null>(null)
  const salvarTopico = useSalvarTopico()
  const [ordem, setOrdem] = usePreferencia<Ordem>('edital:ordem', Object.keys(ORDENS) as Ordem[], 'edital')
  const [mostrar, setMostrar] = usePreferencia<Mostrar>('edital:mostrar', Object.keys(MOSTRAR) as Mostrar[], 'todas')
  const [abertas, setAbertas] = useState<Set<string>>(new Set())

  const resumo = useMemo(() => {
    const r = new Map<string, { total: number; concluidos: number; feitas: number; acertadas: number; tempo: number }>()
    for (const d of disciplinas.data ?? []) r.set(d.id, { total: 0, concluidos: 0, feitas: 0, acertadas: 0, tempo: 0 })
    for (const t of topicos.data ?? []) {
      const x = r.get(t.disciplina_id)
      if (!x) continue
      x.total++
      if (t.concluido) x.concluidos++
    }
    for (const e of estudos.data ?? []) {
      const x = r.get(e.disciplina_id)
      if (!x) continue
      x.feitas += e.questoes_feitas ?? 0
      x.acertadas += e.questoes_acertadas ?? 0
      x.tempo += e.duracao_segundos ?? 0
    }
    return r
  }, [disciplinas.data, topicos.data, estudos.data])

  const lista = disciplinas.data ?? []
  const porTopico = useMemo(() => resumirPorTopico(estudos.data ?? []), [estudos.data])
  /** tópicos de cada disciplina, na ordem do edital */
  const topicosDe = useMemo(() => {
    const m = new Map<string, Topico[]>()
    for (const t of [...(topicos.data ?? [])].sort((a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em))) {
      const l = m.get(t.disciplina_id)
      if (l) l.push(t)
      else m.set(t.disciplina_id, [t])
    }
    return m
  }, [topicos.data])

  // ritmo: tópicos concluídos nas últimas 4 semanas
  const recentes = useMemo(() => {
    const limite = Date.now() - 28 * 24 * 60 * 60 * 1000
    return (topicos.data ?? []).filter((t) => t.concluido && t.concluido_em && new Date(t.concluido_em).getTime() >= limite).length
  }, [topicos.data])

  const visiveis = useMemo(() => {
    const pct = (d: Disciplina) => porcentagem(resumo.get(d.id)?.concluidos ?? 0, resumo.get(d.id)?.total ?? 0) ?? 0
    const acerto = (d: Disciplina) => porcentagem(resumo.get(d.id)?.acertadas ?? 0, resumo.get(d.id)?.feitas ?? 0)
    const filtradas = (disciplinas.data ?? []).filter((d) => {
      const r = resumo.get(d.id)
      if (!r || mostrar === 'todas') return true
      const feita = r.total > 0 && r.concluidos === r.total
      if (mostrar === 'concluidas') return feita
      if (mostrar === 'nao_iniciadas') return r.concluidos === 0
      return r.concluidos > 0 && !feita
    })
    const comparar: Record<Ordem, (a: Disciplina, b: Disciplina) => number> = {
      edital: (a, b) => a.ordem - b.ordem,
      nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
      progresso: (a, b) => pct(b) - pct(a) || a.ordem - b.ordem,
      // sem questões vai para o fim
      acerto: (a, b) => (acerto(a) ?? 101) - (acerto(b) ?? 101) || a.ordem - b.ordem,
    }
    return [...filtradas].sort(comparar[ordem])
  }, [disciplinas.data, resumo, mostrar, ordem])

  const todasAbertas = visiveis.length > 0 && visiveis.every((d) => abertas.has(d.id))
  const alternarAberta = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const totalTopicos = topicos.data?.length ?? 0
  const totalConcluidos = (topicos.data ?? []).filter((t) => t.concluido).length

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluir.mutateAsync(excluindo.id)
      toast.success(`"${excluindo.nome}" foi excluída.`)
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  const progressoGeral = porcentagem(totalConcluidos, totalTopicos) ?? 0

  return (
    <>
      <CabecalhoPagina
        titulo="Edital"
        subtitulo="Acompanhe seu progresso no edital."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setImportando(true)}>
              <FileUp className="size-4" aria-hidden /> Importar edital
            </Botao>
            <Botao onClick={() => setDialogo({ aberto: true, editando: null })}>
              <Plus className="size-4" aria-hidden /> Nova disciplina
            </Botao>
          </>
        }
      />

      {disciplinas.isLoading || topicos.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Painel>
          <Vazio
            icone={<BookOpen className="size-9" />}
            titulo="Comece pelo edital"
            texto="Crie as disciplinas uma a uma ou cole o edital inteiro de uma vez com a importação."
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <Botao variante="secundario" onClick={() => setImportando(true)}>
                  <FileUp className="size-4" aria-hidden /> Importar edital
                </Botao>
                <Botao onClick={() => setDialogo({ aberto: true, editando: null })}>
                  <Plus className="size-4" aria-hidden /> Nova disciplina
                </Botao>
              </div>
            }
          />
        </Painel>
      ) : (
        <>
          <section aria-labelledby="titulo-progresso" className="grid grid-cols-1 gap-4 rounded-2xl border border-linha/70 bg-superficie p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:items-center sm:p-6">
            <div className="min-w-0">
              <h2 id="titulo-progresso" className="text-sm font-semibold text-tinta-suave">
                Progresso no edital
              </h2>
              <p className="mt-1 text-[15px] text-tinta-suave numeros">
                <strong className="font-semibold text-tinta">{totalConcluidos}</strong> de <strong className="font-semibold text-tinta">{totalTopicos}</strong>{' '}
                {totalTopicos === 1 ? 'tópico concluído' : 'tópicos concluídos'} em {lista.length} {lista.length === 1 ? 'disciplina' : 'disciplinas'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-right text-2xl font-semibold text-tinta numeros">{progressoGeral}%</p>
              <BarraProgresso valor={progressoGeral} cor="var(--c-visto)" className="mt-1.5" rotulo="Progresso no edital" />
              <p className="mt-2 flex items-center justify-end gap-1.5 text-sm text-tinta-suave numeros">
                <TrendingUp className="size-4 shrink-0" aria-hidden />
                <span>
                  <strong className="font-semibold text-tinta">{recentes}</strong> {recentes === 1 ? 'tópico' : 'tópicos'} nas últimas 4 semanas · {(recentes / 4).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por semana
                </span>
              </p>
            </div>
          </section>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="block min-w-0 flex-1 space-y-1 text-xs font-semibold text-tinta-suave sm:flex-none">
              Ordenar por
              <span className="relative block">
                <ArrowDownAZ className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
                <Selecao value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="h-10 pl-9 text-sm font-normal">
                  {(Object.keys(ORDENS) as Ordem[]).map((o) => (
                    <option key={o} value={o}>
                      {ORDENS[o]}
                    </option>
                  ))}
                </Selecao>
              </span>
            </label>
            <label className="block min-w-0 flex-1 space-y-1 text-xs font-semibold text-tinta-suave sm:flex-none">
              Mostrar
              <span className="relative block">
                <Filter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
                <Selecao value={mostrar} onChange={(e) => setMostrar(e.target.value as Mostrar)} className="h-10 pl-9 text-sm font-normal">
                  {(Object.keys(MOSTRAR) as Mostrar[]).map((m) => (
                    <option key={m} value={m}>
                      {MOSTRAR[m]}
                    </option>
                  ))}
                </Selecao>
              </span>
            </label>
            <Botao variante="secundario" className="h-10 w-full text-sm sm:ml-auto sm:w-auto" onClick={() => setAbertas(todasAbertas ? new Set() : new Set(visiveis.map((d) => d.id)))} disabled={visiveis.length === 0}>
              {todasAbertas ? <ChevronsDownUp className="size-4" aria-hidden /> : <ChevronsUpDown className="size-4" aria-hidden />}
              {todasAbertas ? 'Recolher todas' : 'Expandir todas'}
            </Botao>
          </div>

          {visiveis.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-linha/70 bg-superficie px-4 py-10 text-center text-tinta-suave">Nenhuma disciplina neste filtro.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visiveis.map((d) => {
                const r = resumo.get(d.id)!
                const progresso = porcentagem(r.concluidos, r.total) ?? 0
                const aberta = abertas.has(d.id)
                const Icone = /direito|legisla|process/i.test(d.nome) ? Scale : BookOpen
                return (
                  <li key={d.id} className="rounded-2xl border border-linha/70 bg-superficie transition-colors hover:border-lilas">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                      <div className="order-1 flex min-w-0 flex-1 basis-[calc(100%-6.5rem)] items-center gap-3 sm:basis-0">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${d.cor} 22%, transparent)`, color: d.cor }} aria-hidden>
                          <Icone className="size-[18px]" />
                        </span>
                        <Link to={`/edital/${d.id}`} className="min-w-0 truncate text-[17px] font-medium text-tinta hover:underline" title={`Abrir ${d.nome}`}>
                          {d.nome}
                        </Link>
                      </div>
                      <p className="order-3 flex shrink-0 items-center gap-2 text-sm text-tinta-suave numeros sm:order-2">
                        <span>
                          <strong className="font-semibold text-tinta">{r.acertadas}</strong> / {r.feitas} {r.feitas === 1 ? 'questão' : 'questões'}
                        </span>
                        <SeloAcerto pct={porcentagem(r.acertadas, r.feitas)} className="min-w-10 justify-center" />
                      </p>
                      <div className="order-4 flex min-w-24 flex-1 items-center gap-3 sm:order-3 sm:w-44 sm:flex-none" title={`${r.concluidos} de ${r.total} ${r.total === 1 ? 'tópico' : 'tópicos'}`}>
                        <BarraProgresso valor={progresso} cor={d.cor} className="h-1.5" rotulo={`Progresso em ${d.nome}: ${r.concluidos} de ${r.total} tópicos`} />
                        <span className="w-10 shrink-0 text-right text-sm font-semibold text-tinta numeros">{progresso}%</span>
                      </div>
                      <div className="order-2 -mr-2 flex shrink-0 items-center sm:order-4">
                        <Botao variante="fantasma" tamanho="icone" aria-label={`Editar ${d.nome}`} onClick={() => setDialogo({ aberto: true, editando: d })}>
                          <Pencil className="size-4" />
                        </Botao>
                        <Botao variante="fantasma" tamanho="icone" aria-expanded={aberta} aria-controls={`topicos-${d.id}`} aria-label={aberta ? `Recolher os tópicos de ${d.nome}` : `Ver os tópicos de ${d.nome}`} onClick={() => alternarAberta(d.id)}>
                          <ChevronDown className={cn('size-5 transition-transform', aberta && 'rotate-180')} />
                        </Botao>
                      </div>
                    </div>
                    {aberta && (
                      <div id={`topicos-${d.id}`} className="border-t border-linha/70 px-4 pb-3 sm:px-5">
                        <TopicosDaDisciplina
                          topicos={topicosDe.get(d.id) ?? []}
                          porTopico={porTopico}
                          aoAlternar={(t) => salvarTopico.mutate({ id: t.id, concluido: !t.concluido }, { onError: (e) => toast.error(mensagemErro(e)) })}
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <Link to={`/edital/${d.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primaria hover:bg-superficie-2">
                            Abrir disciplina <ArrowRight className="size-4" aria-hidden />
                          </Link>
                          <Botao variante="fantasma" className="h-9 px-2 text-sm text-tinta-suave" onClick={() => setExcluindo(d)}>
                            <Trash2 className="size-4" aria-hidden /> Excluir disciplina
                          </Botao>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <DisciplinaDialog
        aberto={dialogo.aberto}
        aoMudar={(a) => setDialogo((s) => ({ ...s, aberto: a }))}
        editando={dialogo.editando}
        proximaOrdem={lista.reduce((m, d) => Math.max(m, d.ordem), -1) + 1}
        coresUsadas={lista.map((d) => d.cor)}
      />
      <ImportarDialog aberto={importando} aoMudar={setImportando} modo="edital" disciplinas={lista} topicos={topicos.data ?? []} />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir disciplina?"
        texto={`"${excluindo?.nome ?? ''}" será excluída junto com todos os tópicos e estudos registrados nela. Isso não pode ser desfeito.`}
        textoBotao="Excluir disciplina"
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </>
  )
}

/** Os tópicos de uma disciplina dentro do Edital: marcar como concluído e ver as questões; o resto é na página da disciplina */
function TopicosDaDisciplina({ topicos, porTopico, aoAlternar }: { topicos: Topico[]; porTopico: ReturnType<typeof resumirPorTopico>; aoAlternar: (t: Topico) => void }) {
  const numeros = useMemo(() => numeracao(topicos), [topicos])
  if (topicos.length === 0) return <p className="py-4 text-sm text-tinta-suave">Esta disciplina ainda não tem tópicos. Abra a disciplina para adicionar.</p>
  return (
    <ul className="-mx-4 divide-y divide-linha/50 sm:-mx-5">
      {topicos.map((t) => {
        // no tópico pai, as questões somam as dos subtópicos
        const r = somarResumos([t, ...descendentesDe(topicos, t.id)].map((x) => porTopico.get(x.id)))
        return (
          <li
            key={t.id}
            // concluído: a linha inteira fica no verde claro do "visto"
            className={cn('flex items-center gap-3 px-4 py-2 transition-colors sm:px-5', t.concluido && 'bg-visto-fundo')}
          >
            <input type="checkbox" className="visto size-5 shrink-0" style={{ marginLeft: `${t.nivel * 1.5}rem` }} checked={t.concluido} onChange={() => aoAlternar(t)} aria-label={`${t.concluido ? 'Desmarcar' : 'Marcar'} ${t.nome} como concluído`} />
            <p className="min-w-0 flex-1 text-[15px] text-tinta">
              <span className="mr-1.5 text-tinta-suave numeros">{numeros.get(t.id)}</span>
              {t.nome}
            </p>
            {r && r.questoesFeitas > 0 && (
              <p className="flex shrink-0 items-center gap-2 text-sm text-tinta-suave numeros">
                {r.questoesAcertadas}/{r.questoesFeitas}
                <SeloAcerto pct={r.acertoPct} />
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
