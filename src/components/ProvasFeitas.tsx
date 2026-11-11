import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useExcluirProvaFeita, useProvasFeitas } from '@/hooks/dados'
import { dataCurta, etapaPrincipal, etapasDaProva, formatarNota, ordenarProvasFeitas, pontosDoGrafico, resumoProvasFeitas, ROTULO_ETAPA, ROTULO_SITUACAO, textoDistancia } from '@/lib/provasFeitas'
import { cn, mensagemErro } from '@/lib/utils'
import type { ProvaFeita, SituacaoProva } from '@/types'
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

/** Raio-X: provas que o usuário já fez, com a nota e a nota de corte de cada etapa */
export function ProvasFeitas({ className }: { className?: string }) {
  const provas = useProvasFeitas()
  const excluir = useExcluirProvaFeita()
  const [dialogo, setDialogo] = useState<{ prova: ProvaFeita | null } | null>(null)
  const [excluindo, setExcluindo] = useState<ProvaFeita | null>(null)

  const lista = useMemo(() => ordenarProvasFeitas(provas.data ?? []), [provas.data])
  const resumo = useMemo(() => resumoProvasFeitas(lista), [lista])
  const pontos = useMemo(() => pontosDoGrafico(lista), [lista])

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluir.mutateAsync(excluindo.id)
      toast.success('Prova excluída.')
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <Painel className={cn('p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Provas que já fiz</h2>
          <p className="mt-1 max-w-prose text-sm text-tinta-suave">Sua nota contra a nota de corte em cada prova, para ver se a distância está diminuindo.</p>
        </div>
        <Botao tamanho="sm" onClick={() => setDialogo({ prova: null })}>
          <Plus className="size-4" aria-hidden /> Adicionar prova
        </Botao>
      </div>

      {provas.isLoading ? (
        <p className="mt-5 text-sm text-tinta-suave">Carregando…</p>
      ) : provas.isError ? (
        <p role="alert" className="mt-5 rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
          Não foi possível carregar as provas. Recarregue a página para tentar de novo.
        </p>
      ) : lista.length === 0 ? (
        <p className="mt-5 rounded-xl bg-superficie-2/60 px-4 py-8 text-center text-sm text-tinta-suave">
          Nenhuma prova lançada ainda. Adicione as que você já fez, com a sua nota e a nota de corte.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Numero rotulo="Provas feitas" valor={String(resumo.feitas)} />
            <Numero rotulo="No corte ou acima" valor={resumo.comparaveis ? `${resumo.noCorte} de ${resumo.comparaveis}` : '–'} />
            <Numero
              rotulo="Quando faltou menos"
              valor={resumo.menorFalta === null ? '–' : `${formatarNota(Math.abs(resumo.menorFalta))} ${Math.abs(resumo.menorFalta) === 1 ? 'ponto' : 'pontos'}`}
            />
          </dl>

          {pontos.length >= 2 && <Grafico pontos={pontos} />}

          <ul className="mt-5 divide-y divide-linha/70 rounded-xl border border-linha/70">
            {lista.map((p) => (
              <Linha key={p.id} prova={p} aoEditar={() => setDialogo({ prova: p })} aoExcluir={() => setExcluindo(p)} />
            ))}
          </ul>
        </>
      )}

      <ProvaFeitaDialog aberto={!!dialogo} aoMudar={(a) => !a && setDialogo(null)} prova={dialogo?.prova ?? null} />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir prova?"
        texto={`"${excluindo?.nome ?? ''}" sai da comparação, com as notas lançadas.`}
        textoBotao="Excluir prova"
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </Painel>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-superficie-2/70 px-4 py-3">
      <dt className="text-sm text-tinta-suave">{rotulo}</dt>
      <dd className="mt-0.5 text-2xl font-semibold text-tinta numeros">{valor}</dd>
    </div>
  )
}

function Linha({ prova, aoEditar, aoExcluir }: { prova: ProvaFeita; aoEditar: () => void; aoExcluir: () => void }) {
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
            {etapas.length > 1 && <span className="font-normal text-tinta-suave"> na {ROTULO_ETAPA[principal.etapa].toLowerCase()}</span>}
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
                  <span className="block text-xs text-tinta-suave">corte {e.corte === null ? '–' : formatarNota(e.corte)}</span>
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

type Ponto = ReturnType<typeof pontosDoGrafico>[number]

/** Barras lado a lado: minha nota e a nota de corte de cada prova, da mais antiga para a mais recente */
function Grafico({ pontos }: { pontos: Ponto[] }) {
  const dados = pontos.map((p) => ({ ...p, rotulo: `${p.nome.length > 14 ? `${p.nome.slice(0, 13)}…` : p.nome} ${p.ano}` }))
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-primaria-forte" aria-hidden /> Minha nota
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-lilas" aria-hidden /> Nota de corte
        </span>
        <span>Nota final; sem ela, a da objetiva.</span>
      </div>
      {/* com muitas provas o gráfico rola para o lado em vez de espremer os nomes */}
      <div className="mt-3 overflow-x-auto [scrollbar-width:thin]">
      <div
        className="h-60"
        style={{ minWidth: dados.length * 124 }}
        role="img"
        aria-label={`Gráfico de barras com a minha nota e a nota de corte de ${dados.length} provas: ${dados.map((p) => `${p.nome} ${p.ano}, ${formatarNota(p.nota)} contra corte de ${formatarNota(p.corte)}`).join('; ')}.`}
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
                      {p.nome} {p.ano} <span className="font-normal text-tinta-suave">({ROTULO_ETAPA[p.etapa].toLowerCase()})</span>
                    </p>
                    <p className="text-tinta-suave numeros">
                      Nota {formatarNota(p.nota)} · corte {formatarNota(p.corte)}
                    </p>
                    <p className={cn('font-semibold numeros', corDistancia(p.distancia))}>{textoDistancia(p.distancia)}</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="nota" name="Minha nota" fill="var(--c-primaria-forte)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="corte" name="Nota de corte" fill="var(--c-lilas)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
    </div>
  )
}
