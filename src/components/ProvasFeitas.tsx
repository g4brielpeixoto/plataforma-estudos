import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useExcluirProvaFeita, useProvasFeitas } from '@/hooks/dados'
import { comparacaoPorDisciplina, dataCurta, doTipo, etapaPrincipal, etapasDaProva, formatarNota, ordenarProvasFeitas, pontosDoGrafico, resumoProvasFeitas, resumoSimulados, type PontoGrafico, ROTULO_ETAPA, ROTULO_SITUACAO, pctDisciplina, textoDistancia, textoNotaDisciplina } from '@/lib/provasFeitas'
import { cn, mensagemErro, nivelAcerto, textoNivel } from '@/lib/utils'
import type { ProvaFeita, SituacaoProva, TipoProvaFeita } from '@/types'
import { ProvaFeitaDialog } from './ProvaFeitaDialog'
import { Botao, Confirmar, Painel } from './ui'

const eixo = { fontSize: 12, fill: 'var(--c-tinta-suave)' }

const corSituacao: Record<SituacaoProva, string> = {
  aprovado: 'bg-bom-fundo text-bom',
  classificado: 'bg-bom-fundo text-bom',
  nao_classificado: 'bg-ruim-fundo text-ruim',
  eliminado: 'bg-ruim-fundo text-ruim',
  aguardando: 'bg-superficie-2 text-tinta-suave',
}

/** Cor do texto da distância: verde no corte ou acima, vermelho abaixo (o texto já diz qual é) */
const corDistancia = (d: number) => (d >= 0 ? 'text-bom' : 'text-ruim')

/** Textos de cada lista: as provas de verdade e os simulados usam a mesma tela */
const TEXTOS = {
  prova: {
    titulo: 'Provas que já fiz',
    descricao: 'Sua pontuação contra a nota de corte em cada prova, e a nota em cada disciplina.',
    adicionar: 'Adicionar prova',
    vazio: 'Nenhuma prova lançada ainda. Adicione as que você já fez, com a sua nota e a nota de corte.',
    erro: 'Não foi possível carregar as provas. Recarregue a página para tentar de novo.',
    excluida: 'Prova excluída.',
    excluir: 'Excluir prova',
    plural: 'provas',
    coluna: 'da prova mais antiga para a mais recente',
    semDisciplina: 'a prova não teve',
  },
  simulado: {
    titulo: 'Simulados',
    descricao: 'Sua pontuação em cada simulado e a nota em cada disciplina, para acompanhar a evolução.',
    adicionar: 'Adicionar simulado',
    vazio: 'Nenhum simulado lançado ainda. Adicione os que você fez, com a nota de cada disciplina.',
    erro: 'Não foi possível carregar os simulados. Recarregue a página para tentar de novo.',
    excluida: 'Simulado excluído.',
    excluir: 'Excluir simulado',
    plural: 'simulados',
    coluna: 'do simulado mais antigo para o mais recente',
    semDisciplina: 'o simulado não teve',
  },
} satisfies Record<TipoProvaFeita, Record<string, string>>

/** Raio-X: provas (ou simulados) que o usuário já fez, com a pontuação, o corte e a nota por disciplina */
export function ProvasFeitas({ tipo = 'prova', className }: { tipo?: TipoProvaFeita; className?: string }) {
  const tx = TEXTOS[tipo]
  const provas = useProvasFeitas()
  const excluir = useExcluirProvaFeita()
  const [dialogo, setDialogo] = useState<{ prova: ProvaFeita | null } | null>(null)
  const [excluindo, setExcluindo] = useState<ProvaFeita | null>(null)

  const lista = useMemo(() => ordenarProvasFeitas(doTipo(provas.data ?? [], tipo)), [provas.data, tipo])
  const resumo = useMemo(() => resumoProvasFeitas(lista), [lista])
  const simulados = useMemo(() => resumoSimulados(lista), [lista])
  const pontos = useMemo(() => pontosDoGrafico(lista, tipo), [lista, tipo])
  const comparacao = useMemo(() => comparacaoPorDisciplina(lista), [lista])

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluir.mutateAsync(excluindo.id)
      toast.success(tx.excluida)
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <Painel className={cn('p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">{tx.titulo}</h2>
          <p className="mt-1 max-w-prose text-sm text-tinta-suave">{tx.descricao}</p>
        </div>
        <Botao tamanho="sm" onClick={() => setDialogo({ prova: null })}>
          <Plus className="size-4" aria-hidden /> {tx.adicionar}
        </Botao>
      </div>

      {provas.isLoading ? (
        <p className="mt-5 text-sm text-tinta-suave">Carregando…</p>
      ) : provas.isError ? (
        <p role="alert" className="mt-5 rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
          {tx.erro}
        </p>
      ) : lista.length === 0 ? (
        <p className="mt-5 rounded-xl bg-superficie-2/60 px-4 py-8 text-center text-sm text-tinta-suave">
          {tx.vazio}
        </p>
      ) : (
        <>
          {tipo === 'simulado' ? (
            <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Numero rotulo="Simulados feitos" valor={String(simulados.feitos)} />
              <Numero rotulo="Melhor pontuação" valor={simulados.melhor === null ? '–' : formatarNota(simulados.melhor)} />
              <Numero
                rotulo="Último simulado"
                valor={simulados.ultima === null ? '–' : formatarNota(simulados.ultima)}
                detalhe={
                  simulados.variacao === null
                    ? undefined
                    : simulados.variacao === 0
                      ? 'igual ao anterior'
                      : `${formatarNota(Math.abs(simulados.variacao))} ${simulados.variacao > 0 ? 'a mais' : 'a menos'} que o anterior`
                }
                corDetalhe={simulados.variacao === null || simulados.variacao === 0 ? undefined : corDistancia(simulados.variacao)}
              />
            </dl>
          ) : (
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Numero rotulo="Provas feitas" valor={String(resumo.feitas)} />
            <Numero rotulo="No corte ou acima" valor={resumo.comparaveis ? `${resumo.noCorte} de ${resumo.comparaveis}` : '–'} />
            <Numero
              rotulo="Quando faltou menos"
              valor={resumo.menorFalta === null ? '–' : `${formatarNota(Math.abs(resumo.menorFalta))} ${Math.abs(resumo.menorFalta) === 1 ? 'ponto' : 'pontos'}`}
            />
          </dl>
          )}

          {pontos.length >= 2 && <Grafico pontos={pontos} plural={tx.plural} />}

          <ul className="mt-5 divide-y divide-linha/70 rounded-xl border border-linha/70">
            {lista.map((p) => (
              <Linha key={p.id} prova={p} mostrarEtapa={tipo === 'prova'} aoEditar={() => setDialogo({ prova: p })} aoExcluir={() => setExcluindo(p)} />
            ))}
          </ul>

          {comparacao.linhas.length > 0 && <PorDisciplinaNasProvas {...comparacao} ordem={tx.coluna} semDisciplina={tx.semDisciplina} comDia={tipo === 'simulado'} />}
        </>
      )}

      <ProvaFeitaDialog aberto={!!dialogo} aoMudar={(a) => !a && setDialogo(null)} prova={dialogo?.prova ?? null} tipo={tipo} />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo={`${tx.excluir}?`}
        texto={`"${excluindo?.nome ?? ''}" sai da comparação, com as notas lançadas.`}
        textoBotao={tx.excluir}
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </Painel>
  )
}

function Numero({ rotulo, valor, detalhe, corDetalhe }: { rotulo: string; valor: string; detalhe?: string; corDetalhe?: string }) {
  return (
    <div className="rounded-xl bg-superficie-2/70 px-4 py-3">
      <dt className="text-sm text-tinta-suave">{rotulo}</dt>
      <dd className="mt-0.5 numeros">
        <span className="text-2xl font-semibold text-tinta">{valor}</span>
        {detalhe && <span className={cn('ml-2 text-sm font-medium', corDetalhe ?? 'text-tinta-suave')}>{detalhe}</span>}
      </dd>
    </div>
  )
}

function Linha({ prova, mostrarEtapa, aoEditar, aoExcluir }: { prova: ProvaFeita; mostrarEtapa: boolean; aoEditar: () => void; aoExcluir: () => void }) {
  const etapas = etapasDaProva(prova)
  const principal = etapaPrincipal(prova)
  const detalhes = [prova.cargo, prova.banca, dataCurta(prova.data), prova.classificacao ? `${prova.classificacao}º lugar` : null].filter(Boolean).join(' · ')
  const botoes = (
    <>
      <Botao variante="fantasma" tamanho="icone" aria-label={`Editar ${prova.nome}`} onClick={aoEditar}>
        <Pencil className="size-4" />
      </Botao>
      <Botao variante="fantasma" tamanho="icone" aria-label={`Excluir ${prova.nome}`} onClick={aoExcluir}>
        <Trash2 className="size-4" />
      </Botao>
    </>
  )
  return (
    <li className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-semibold text-tinta [overflow-wrap:anywhere]">{prova.nome}</p>
            {prova.situacao && <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', corSituacao[prova.situacao])}>{ROTULO_SITUACAO[prova.situacao]}</span>}
          </div>
          {/* no celular os botões ficam ao lado do nome, para as notas usarem a largura toda */}
          <div className="-mt-1.5 -mr-2 flex shrink-0 lg:hidden">{botoes}</div>
        </div>
        <p className="mt-0.5 text-sm text-tinta-suave numeros">{detalhes}</p>
        {principal && principal.distancia !== null && (
          <p className={cn('mt-1.5 text-sm font-semibold numeros', corDistancia(principal.distancia))}>
            {textoDistancia(principal.distancia)}
            {mostrarEtapa && principal.etapa !== 'final' && <span className="font-normal text-tinta-suave"> na {ROTULO_ETAPA[principal.etapa].toLowerCase()}</span>}
          </p>
        )}
        {prova.observacao && <p className="mt-1.5 max-w-prose text-sm text-tinta-suave [overflow-wrap:anywhere]">{prova.observacao}</p>}
      </div>

      <div className="flex items-center gap-2">
        {etapas.length === 0 ? (
          <p className="flex-1 text-sm text-tinta-suave">Sem notas lançadas</p>
        ) : (
          <dl className="flex flex-1 flex-wrap gap-2">
            {etapas.map((e) => (
              <div key={e.etapa} className="min-w-[5.5rem] flex-1 rounded-lg lg:min-w-[6.5rem] lg:flex-none bg-superficie-2/70 px-3 py-2">
                <dt className="text-xs font-medium text-tinta-suave">{ROTULO_ETAPA[e.etapa]}</dt>
                <dd className="numeros">
                  <span className="text-lg font-semibold text-tinta">{e.nota === null ? '–' : formatarNota(e.nota)}</span>
                  {(mostrarEtapa || e.corte !== null) && <span className="block text-xs text-tinta-suave">corte {e.corte === null ? '–' : formatarNota(e.corte)}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="hidden shrink-0 lg:flex">{botoes}</div>
      </div>
    </li>
  )
}

type Ponto = PontoGrafico

/** Barras lado a lado: minha nota e a nota de corte de cada prova, da mais antiga para a mais recente */
function Grafico({ pontos, plural }: { pontos: Ponto[]; plural: string }) {
  const temCorte = pontos.some((p) => p.corte !== null)
  const dados = pontos.map((p) => ({ ...p, rotulo: `${p.nome.length > 14 ? `${p.nome.slice(0, 13)}…` : p.nome} ${p.quando}` }))
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-primaria-forte" aria-hidden /> Minha pontuação
        </span>
        {temCorte && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-lilas" aria-hidden /> Nota de corte
          </span>
        )}
      </div>
      {/* com muitas provas o gráfico rola para o lado em vez de espremer os nomes */}
      <div className="mt-3 overflow-x-auto [scrollbar-width:thin]">
      <div
        className="h-60"
        style={{ minWidth: dados.length * 124 }}
        role="img"
        aria-label={`Gráfico de barras com a minha pontuação e a nota de corte de $${dados.length} ${plural}: ${dados.map((p) => `${p.nome} ${p.quando}, ${formatarNota(p.nota)}${p.corte === null ? '' : ` contra corte de ${formatarNota(p.corte)}`}`).join('; ')}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -14 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--c-linha)" strokeDasharray="4 4" />
            <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={{ stroke: 'var(--c-linha)' }} interval={0} />
            <YAxis tick={eixo} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--c-nevoa)', fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as Ponto
                return (
                  <div className="rounded-xl border border-linha bg-superficie px-3 py-2 text-sm shadow-lg">
                    <p className="font-medium text-tinta">
                      {p.nome} <span className="font-normal text-tinta-suave">{p.quando}</span>
                    </p>
                    <p className="text-tinta-suave numeros">
                      Pontuação {formatarNota(p.nota)}
                      {p.corte !== null && ` · corte ${formatarNota(p.corte)}`}
                    </p>
                    {p.distancia !== null && <p className={cn('font-semibold numeros', corDistancia(p.distancia))}>{textoDistancia(p.distancia)}</p>}
                  </div>
                )
              }}
            />
            <Bar dataKey="nota" name="Minha pontuação" fill="var(--c-primaria-forte)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            {temCorte && <Bar dataKey="corte" name="Nota de corte" fill="var(--c-lilas)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
    </div>
  )
}

/** Cor do aproveitamento pelas faixas de acerto do app; o número vai sempre junto */
const corPct = (pct: number | null) => {
  const nivel = nivelAcerto(pct)
  return nivel ? textoNivel[nivel] : 'text-tinta'
}

/** Tabela disciplina × prova: aproveitamento (ou só a nota, sem total) em cada disciplina, prova a prova, e no geral */
function PorDisciplinaNasProvas({ colunas, linhas, ordem, semDisciplina, comDia }: ReturnType<typeof comparacaoPorDisciplina> & { ordem: string; semDisciplina: string; comDia: boolean }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-tinta">Por disciplina</h3>
      <p className="mt-0.5 text-sm text-tinta-suave">Seu aproveitamento em cada disciplina, {ordem}. Sem o total, aparece só a nota. O traço marca a disciplina que {semDisciplina}.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-linha/70 [scrollbar-width:thin]">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-superficie-2/70 text-left text-tinta-suave">
              <th scope="col" className="sticky left-0 bg-superficie-2 px-4 py-2.5 font-medium">
                Disciplina
              </th>
              {colunas.map((p) => (
                <th key={p.id} scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                  <span className="block max-w-40 truncate text-tinta" title={p.nome}>
                    {p.nome}
                  </span>
                  <span className="block text-xs font-normal numeros">{comDia ? dataCurta(p.data) : p.data.slice(0, 4)}</span>
                </th>
              ))}
              {colunas.length > 1 && (
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Geral
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha/70">
            {linhas.map((l) => (
              <tr key={l.nome}>
                <th scope="row" className="sticky left-0 bg-superficie px-4 py-2.5 text-left font-medium whitespace-nowrap text-tinta">
                  {l.nome}
                </th>
                {l.celulas.map((c, i) => {
                  if (!c)
                    return (
                      <td key={i} className="px-4 py-2.5 text-right text-tinta-suave" aria-label="Não teve esta disciplina">
                        –
                      </td>
                    )
                  const pct = pctDisciplina(c)
                  return (
                    <td key={i} className="px-4 py-2.5 text-right whitespace-nowrap numeros">
                      {pct !== null && <span className={cn('font-semibold', corPct(pct))}>{pct}%</span>}
                      <span className={cn(pct === null ? 'text-tinta' : 'ml-2 text-xs text-tinta-suave')}>{textoNotaDisciplina(c)}</span>
                    </td>
                  )
                })}
                {colunas.length > 1 && (
                  <td className={cn('px-4 py-2.5 text-right font-semibold whitespace-nowrap numeros', corPct(l.geral))}>
                    {l.geral !== null ? `${l.geral}%` : l.media !== null ? `média ${formatarNota(l.media)}` : '–'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
