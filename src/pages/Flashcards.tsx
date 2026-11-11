import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, Flame, Layers, Plus, Settings2, Target, Upload } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ConfigFlashDialog } from '@/components/flashcards/ConfigFlashDialog'
import { ImportarAnkiDialog } from '@/components/flashcards/ImportarAnkiDialog'
import { NotaFlashDialog } from '@/components/flashcards/NotaFlashDialog'
import { Botao, CabecalhoPagina, Carregando, Painel } from '@/components/ui'
import { filtroEscopo, useDadosFlash } from '@/hooks/useFlash'
import { contagemPorEstado, porDia, previsao, resumir, revisoesDoDia, sequenciaDias } from '@/lib/flashcards/estatisticas'
import { contagem } from '@/lib/flashcards/fila'
import { cn, formatarDuracao } from '@/lib/utils'

const tituloCard = 'text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase'

/** Os três números do Anki: novos (azul), aprendendo (vermelho), revisar (verde) */
export function Contadores({ novos, aprendendo, revisar, className }: { novos: number; aprendendo: number; revisar: number; className?: string }) {
  const item = (n: number, cor: string, rotulo: string) => (
    <span className={cn('min-w-8 text-right font-semibold numeros', n ? cor : 'text-tinta-suave/50')} title={rotulo}>
      <span className="sr-only">{rotulo}: </span>
      {n}
    </span>
  )
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      {item(novos, 'text-revisao', 'Novos')}
      {item(aprendendo, 'text-ruim', 'Aprendendo')}
      {item(revisar, 'text-bom', 'Revisar')}
    </span>
  )
}

function Resumo({ titulo, icone, valor, rodape }: { titulo: string; icone: ReactNode; valor: ReactNode; rodape: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-linha/70 bg-superficie p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-tinta-suave uppercase sm:pt-1.5 sm:text-[13px]">{titulo}</h2>
        <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-nevoa text-primaria-forte sm:grid dark:text-primaria">{icone}</span>
      </div>
      <p className="mt-3 text-[1.55rem] leading-none font-semibold tracking-tight text-tinta numeros sm:text-[1.9rem]">{valor}</p>
      <p className="mt-auto pt-3 text-[13px] text-tinta-suave numeros sm:text-sm">{rodape}</p>
    </section>
  )
}

export function Flashcards() {
  const dados = useDadosFlash()
  const navegar = useNavigate()
  const [importando, setImportando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [ajustando, setAjustando] = useState(false)

  const baralhos = useMemo(() => {
    const comNotas = new Set(dados.notas.map((n) => n.disciplina_id))
    return dados.disciplinas
      .filter((d) => comNotas.has(d.id))
      .map((d) => ({ disciplina: d, ...contagem(dados.disponiveisEm(filtroEscopo(d.id))), notas: dados.notas.filter((n) => n.disciplina_id === d.id).length }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.disciplinas, dados.notas, dados.cartoes, dados.feitos, dados.limites.novos_por_dia, dados.limites.revisoes_por_dia])

  const total = baralhos.reduce((s, b) => ({ novos: s.novos + b.novos, aprendendo: s.aprendendo + b.aprendendo, revisar: s.revisar + b.revisar }), { novos: 0, aprendendo: 0, revisar: 0 })
  const hoje = resumir(revisoesDoDia(dados.revisoes))
  const sequencia = sequenciaDias(dados.revisoes)
  const estados = contagemPorEstado(dados.cartoes)
  const ultimos = porDia(dados.revisoes, 30)
  const proximos = previsao(dados.cartoes, 7)
  const paraHoje = total.novos + total.aprendendo + total.revisar

  if (dados.carregando) return <Carregando />

  const vazio = dados.notas.length === 0

  return (
    <>
      <CabecalhoPagina
        titulo="Flashcards"
        subtitulo="Repetição espaçada no estilo do Anki. Cada disciplina é um baralho."
        acoes={
          <>
            <Botao variante="fantasma" tamanho="icone" onClick={() => setAjustando(true)} aria-label="Ajustes dos flashcards" title="Ajustes (limites e retenção)">
              <Settings2 className="size-5" aria-hidden />
            </Botao>
            <Botao variante="secundario" onClick={() => setImportando(true)}>
              <Upload className="size-4" aria-hidden /> Importar do Anki
            </Botao>
            <Botao onClick={() => setCriando(true)}>
              <Plus className="size-4" aria-hidden /> Novo cartão
            </Botao>
          </>
        }
      />

      {vazio ? (
        <Painel className="flex flex-col items-center px-6 py-14 text-center">
          <Layers className="size-10 text-lavanda" aria-hidden />
          <p className="mt-3 text-xl text-tinta">Nenhum cartão ainda</p>
          <p className="mt-1 max-w-md text-tinta-suave">Traga os baralhos que você já tem no Anki, com o progresso, ou crie o primeiro cartão aqui.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Botao onClick={() => setImportando(true)}>
              <Upload className="size-4" aria-hidden /> Importar do Anki
            </Botao>
            <Botao variante="secundario" onClick={() => setCriando(true)}>
              <Plus className="size-4" aria-hidden /> Criar cartão
            </Botao>
          </div>
        </Painel>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Resumo
              titulo="Para hoje"
              icone={<CalendarClock className="size-[18px]" aria-hidden />}
              valor={paraHoje.toLocaleString('pt-BR')}
              rodape={paraHoje ? `${total.novos} novos · ${total.aprendendo + total.revisar} para revisar` : 'Tudo em dia'}
            />
            <Resumo
              titulo="Revisados hoje"
              icone={<Layers className="size-[18px]" aria-hidden />}
              valor={hoje.total.toLocaleString('pt-BR')}
              rodape={hoje.total ? (hoje.duracaoMs < 60_000 ? 'em menos de 1 min' : `em ${formatarDuracao(hoje.duracaoMs / 1000)}`) : 'Nenhuma revisão ainda'}
            />
            <Resumo
              titulo="Acerto hoje"
              icone={<Target className="size-[18px]" aria-hidden />}
              valor={hoje.acertoPct === null ? '—' : `${hoje.acertoPct}%`}
              rodape={hoje.total ? `${hoje.total - hoje.acertos} ${hoje.total - hoje.acertos === 1 ? 'errada' : 'erradas'}` : 'Respostas diferentes de "Errei"'}
            />
            <Resumo
              titulo="Sequência"
              icone={<Flame className="size-[18px] text-chama" aria-hidden />}
              valor={`${sequencia} ${sequencia === 1 ? 'dia' : 'dias'}`}
              rodape="seguidos revisando"
            />
          </div>

          <Painel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
              <h2 className={tituloCard}>Baralhos</h2>
              <span className="flex items-center gap-3 text-xs text-tinta-suave" aria-hidden>
                <span className="text-revisao">Novos</span>
                <span className="text-ruim">Aprendendo</span>
                <span className="text-bom">Revisar</span>
              </span>
            </div>
            <ul className="mt-3 divide-y divide-linha/60">
              {baralhos.map((b) => {
                const tem = b.novos + b.aprendendo + b.revisar > 0
                return (
                  <li key={b.disciplina.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
                    <Link to={`/flashcards/${b.disciplina.id}`} className="group flex min-w-0 flex-1 basis-48 items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.disciplina.cor }} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-tinta group-hover:text-primaria-forte dark:group-hover:text-primaria">{b.disciplina.nome}</span>
                        <span className="block text-xs text-tinta-suave numeros">
                          {b.notas} {b.notas === 1 ? 'nota' : 'notas'}
                        </span>
                      </span>
                    </Link>
                    <div className="ml-auto flex items-center gap-4">
                      <Contadores novos={b.novos} aprendendo={b.aprendendo} revisar={b.revisar} />
                      <Botao tamanho="sm" variante={tem ? 'primario' : 'secundario'} disabled={!tem} onClick={() => navegar(`/flashcards/estudar/${b.disciplina.id}`)} className="w-24">
                        {tem ? 'Estudar' : 'Em dia'}
                      </Botao>
                    </div>
                  </li>
                )
              })}
            </ul>
            {baralhos.length > 1 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-linha/70 bg-superficie-2/60 px-5 py-3 sm:px-6">
                <span className="flex-1 basis-48 font-semibold text-tinta">Todos os baralhos</span>
                <div className="ml-auto flex items-center gap-4">
                  <Contadores novos={total.novos} aprendendo={total.aprendendo} revisar={total.revisar} />
                  <Botao tamanho="sm" disabled={!paraHoje} onClick={() => navegar('/flashcards/estudar/todos')} className="w-24">
                    Estudar tudo
                  </Botao>
                </div>
              </div>
            )}
          </Painel>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <GraficoRevisoes pontos={ultimos} />
            <Painel className="p-5 sm:p-6">
              <h2 className={tituloCard}>Cartões</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {(
                  [
                    ['Novos', estados.novos, 'Ainda não estudados'],
                    ['Aprendendo', estados.aprendendo, 'Nos passos de 1 e 10 minutos'],
                    ['Jovens', estados.jovens, 'Intervalo menor que 21 dias'],
                    ['Maduros', estados.maduros, 'Intervalo de 21 dias ou mais'],
                    ['Suspensos', estados.suspensos, 'Fora das revisões'],
                    ['Total', estados.total, ''],
                  ] as [string, number, string][]
                ).map(([r, n, dica]) => (
                  <div key={r} title={dica || undefined}>
                    <dt className="text-tinta-suave">{r}</dt>
                    <dd className="text-lg font-semibold text-tinta numeros">{n.toLocaleString('pt-BR')}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-6 text-sm font-semibold text-tinta">Revisões nos próximos dias</h3>
              <ul className="mt-2 space-y-1 text-sm numeros">
                {proximos.map((p) => (
                  <li key={p.dia.toISOString()} className="flex justify-between gap-3">
                    <span className="text-tinta-suave first-letter:uppercase">{isToday(p.dia) ? 'hoje' : format(p.dia, "EEE, dd/MM", { locale: ptBR })}</span>
                    <span className={cn('font-medium', p.total ? 'text-tinta' : 'text-tinta-suave/60')}>{p.total}</span>
                  </li>
                ))}
              </ul>
            </Painel>
          </div>
        </div>
      )}

      <NotaFlashDialog aberto={criando} aoMudar={setCriando} />
      <ImportarAnkiDialog
        aberto={importando}
        aoMudar={setImportando}
        disciplinas={dados.disciplinas}
        topicos={dados.topicos}
        notasExistentes={dados.notas}
        cartoesExistentes={dados.cartoes}
      />
      <ConfigFlashDialog aberto={ajustando} aoMudar={setAjustando} config={dados.config} />
    </>
  )
}

const eixo = { fontSize: 12, fill: 'var(--c-tinta-suave)' }

function GraficoRevisoes({ pontos }: { pontos: { dia: Date; total: number; acertos: number }[] }) {
  const dados = pontos.map((p) => ({ ...p, rotulo: format(p.dia, 'dd/MM'), hoje: isToday(p.dia) }))
  const soma = pontos.reduce((s, p) => ({ total: s.total + p.total, acertos: s.acertos + p.acertos }), { total: 0, acertos: 0 })
  const vazio = soma.total === 0
  return (
    <Painel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={tituloCard}>Revisões nos últimos 30 dias</h2>
        {!vazio && (
          <p className="text-sm text-tinta-suave numeros">
            {soma.total.toLocaleString('pt-BR')} revisões · {Math.round((soma.acertos / soma.total) * 100)}% de acerto
          </p>
        )}
      </div>
      <div className="mt-4 h-52" role="img" aria-label={`Gráfico de barras com as revisões de flashcards por dia nos últimos 30 dias: ${soma.total} no total`}>
        {vazio ? (
          <p className="grid h-full place-items-center rounded-xl bg-superficie-2/60 text-sm text-tinta-suave">Nenhuma revisão nos últimos 30 dias.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--c-linha)" strokeDasharray="4 4" />
              <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={{ stroke: 'var(--c-linha)' }} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={eixo} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'var(--c-nevoa)', fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof dados)[number]
                  return (
                    <div className="rounded-xl border border-linha bg-superficie px-3 py-2 text-sm shadow-lg">
                      <p className="font-medium text-tinta first-letter:uppercase">{format(p.dia, "EEEE, d 'de' MMM", { locale: ptBR })}</p>
                      <p className="text-tinta-suave numeros">
                        {p.total ? `${p.total} ${p.total === 1 ? 'revisão' : 'revisões'} · ${Math.round((p.acertos / p.total) * 100)}% de acerto` : 'Sem revisões'}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                {dados.map((p) => (
                  <Cell key={p.rotulo} fill={p.hoje ? 'var(--c-primaria)' : 'var(--c-lavanda)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Painel>
  )
}
