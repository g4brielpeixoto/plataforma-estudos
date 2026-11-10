import { differenceInCalendarDays, eachDayOfInterval, eachWeekOfInterval, format, startOfDay, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar } from '@/components/Avatar'
import { Constancia } from '@/components/Constancia'
import { EstudoDialog } from '@/components/EstudoDialog'
import { FiltroPeriodo, PainelIndicadores } from '@/components/Indicadores'
import { MapaCalor } from '@/components/MapaCalor'
import { MetasSemanais } from '@/components/MetasSemanais'
import { TempoPizza } from '@/components/TempoPizza'
import { BarraProgresso, Botao, Carregando, Painel, SeloAcerto } from '@/components/ui'
import { VersiculoCard } from '@/components/VersiculoCard'
import { useAuth } from '@/contexts/AuthContext'
import { useDisciplinas, useEstudos, useTopicos } from '@/hooks/dados'
import { primeiroNome } from '@/lib/foto'
import { calcularIndicadores, filtrarPorPeriodo, intervaloDoPeriodo, resumirPorTopico, type Periodo } from '@/lib/indicadores'
import { formatarDuracao, porcentagem } from '@/lib/utils'
import type { Estudo } from '@/types'

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Série por dia (períodos curtos) ou por semana (longos) */
function montarSerie(estudos: Estudo[], periodo: Periodo) {
  const intervalo = intervaloDoPeriodo(periodo)
  const hoje = new Date()
  const maisAntigo = estudos.length ? new Date(estudos[estudos.length - 1].data_hora) : hoje
  let de = intervalo?.de ?? startOfDay(maisAntigo)
  const ate = intervalo?.ate && intervalo.ate < hoje ? intervalo.ate : hoje
  if (periodo.preset === 'hoje' || differenceInCalendarDays(ate, de) < 6) de = startOfDay(new Date(ate.getTime() - 6 * 86_400_000))
  const porDia = differenceInCalendarDays(ate, de) <= 31

  const baldes = porDia
    ? eachDayOfInterval({ start: de, end: ate }).map((d) => ({ chave: format(d, 'yyyy-MM-dd'), rotulo: format(d, 'dd/MM'), dica: format(d, "EEE, d 'de' MMM", { locale: ptBR }) }))
    : eachWeekOfInterval({ start: de, end: ate }, { weekStartsOn: 1 }).map((d) => ({
        chave: format(d, 'yyyy-MM-dd'),
        rotulo: format(d, 'dd/MM'),
        dica: `Semana de ${format(d, "d 'de' MMM", { locale: ptBR })}`,
      }))
  const mapa = new Map(baldes.map((b) => [b.chave, { ...b, minutos: 0, feitas: 0, acertadas: 0 }]))
  for (const e of estudos) {
    const d = new Date(e.data_hora)
    const chave = format(porDia ? d : startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const b = mapa.get(chave)
    if (!b) continue
    b.minutos += (e.duracao_segundos ?? 0) / 60
    b.feitas += e.questoes_feitas ?? 0
    b.acertadas += e.questoes_acertadas ?? 0
  }
  return {
    porDia,
    pontos: [...mapa.values()].map((b) => ({ ...b, minutos: Math.round(b.minutos), acerto: porcentagem(b.acertadas, b.feitas) })),
  }
}

const eixo = { fontSize: 12, fill: 'var(--c-tinta-suave)' }

function Dica({ active, payload, tipo }: { active?: boolean; payload?: { payload: { dica: string; minutos: number; feitas: number; acertadas: number; acerto: number | null } }[]; tipo: 'tempo' | 'acerto' }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-linha bg-superficie px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-tinta">{p.dica}</p>
      {tipo === 'tempo' ? (
        <p className="text-tinta-suave numeros">{formatarDuracao(p.minutos * 60)} de estudo</p>
      ) : p.acerto === null ? (
        <p className="text-tinta-suave">Sem questões</p>
      ) : (
        <p className="text-tinta-suave numeros">
          {p.acerto}% · {p.acertadas} de {p.feitas} questões
        </p>
      )}
    </div>
  )
}

export function Inicio() {
  const estudos = useEstudos()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const navegar = useNavigate()
  const { perfil } = useAuth()
  const nome = primeiroNome(perfil?.nome)
  const [periodo, setPeriodo] = useState<Periodo>({ preset: '7d' })
  const [adicionando, setAdicionando] = useState(false)

  const filtrados = useMemo(() => filtrarPorPeriodo(estudos.data ?? [], periodo), [estudos.data, periodo])
  const ind = calcularIndicadores(filtrados, topicos.data ?? [])
  const serie = useMemo(() => montarSerie(filtrados, periodo), [filtrados, periodo])

  const porDisciplina = useMemo(() => {
    const topicoParaDisciplina = new Map((topicos.data ?? []).map((t) => [t.id, t.disciplina_id]))
    return (disciplinas.data ?? []).map((d) => {
      const meus = (topicos.data ?? []).filter((t) => t.disciplina_id === d.id)
      const est = filtrados.filter((e) => topicoParaDisciplina.get(e.topico_id) === d.id)
      return { disciplina: d, ...calcularIndicadores(est, meus) }
    })
  }, [disciplinas.data, topicos.data, filtrados])

  // pontos de atenção olham o histórico inteiro, não só o período
  const atencao = useMemo(() => {
    const resumo = resumirPorTopico(estudos.data ?? [])
    const nomeDisciplina = new Map((disciplinas.data ?? []).map((d) => [d.id, d]))
    const lista = (topicos.data ?? []).map((t) => ({ topico: t, disciplina: nomeDisciplina.get(t.disciplina_id), resumo: resumo.get(t.id) }))
    const piores = lista
      .filter((x) => x.resumo && x.resumo.questoesFeitas >= 5 && x.resumo.acertoPct !== null && x.resumo.acertoPct < 80)
      .sort((a, b) => (a.resumo!.acertoPct ?? 0) - (b.resumo!.acertoPct ?? 0))
      .slice(0, 5)
    const parados = lista
      .filter((x) => !x.topico.concluido && x.resumo?.ultimoEstudo)
      .sort((a, b) => a.resumo!.ultimoEstudo!.localeCompare(b.resumo!.ultimoEstudo!))
      .slice(0, 5)
    return { piores, parados }
  }, [estudos.data, topicos.data, disciplinas.data])

  const carregando = estudos.isLoading || topicos.isLoading || disciplinas.isLoading
  const semEdital = !carregando && (disciplinas.data ?? []).length === 0
  const temTempo = serie.pontos.some((p) => p.minutos > 0)
  const temQuestoes = serie.pontos.some((p) => p.feitas > 0)

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/perfil" aria-label="Meu perfil" className="shrink-0 rounded-full">
            <Avatar nome={perfil?.nome} email={perfil?.email} foto={perfil?.foto_url} tamanho={56} />
          </Link>
          <div className="min-w-0">
            <p className="text-tinta-suave">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            <h1 className="font-serif text-[1.85rem] leading-tight font-medium tracking-[-0.01em] text-tinta">
              {saudacao()}
              {nome ? `, ${nome}` : ''}!
            </h1>
            {!nome && (
              <Link to="/perfil" className="text-sm font-medium text-primaria-forte underline-offset-2 hover:underline dark:text-primaria">
                Adicione seu nome e sua foto
              </Link>
            )}
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Botao variante="secundario" onClick={() => setAdicionando(true)} className="h-11 px-3 text-sm sm:h-10 sm:px-4 sm:text-[15px]">
            <Plus className="size-4" aria-hidden /> Adicionar estudo
          </Botao>
          <Botao onClick={() => navegar('/estudar')} className="h-11 px-3 text-sm sm:h-10 sm:px-4 sm:text-[15px]">
            <Timer className="size-4" aria-hidden /> Estudar agora
          </Botao>
        </div>
      </div>

      <VersiculoCard className="mb-8" />

      {carregando ? (
        <Carregando />
      ) : semEdital ? (
        <Painel className="p-6 text-center sm:p-8">
          <p className="font-serif text-xl text-tinta">Vamos montar seu edital?</p>
          <p className="mx-auto mt-2 max-w-md text-tinta-suave">
            Cadastre as disciplinas e os tópicos (ou cole o edital inteiro). Depois é só estudar e registrar: os indicadores aparecem aqui.
          </p>
          <Link to="/edital" className="mt-5 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria hover:bg-primaria-forte">
            Montar o edital
          </Link>
        </Painel>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <TempoPizza estudos={estudos.data ?? []} topicos={topicos.data ?? []} disciplinas={disciplinas.data ?? []} className="md:row-span-2 xl:row-span-1" />
            <MetasSemanais estudos={estudos.data ?? []} />
            <Constancia estudos={estudos.data ?? []} />
          </div>
          <MapaCalor estudos={estudos.data ?? []} className="mb-10" />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-tinta">Seu desempenho</h2>
            <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} />
          </div>
          <PainelIndicadores dados={ind} className="mb-5" />

          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Painel className="p-5">
              <h3 className="font-semibold text-tinta">Tempo de estudo {serie.porDia ? 'por dia' : 'por semana'}</h3>
              <div className="mt-4 h-52" role="img" aria-label={`Gráfico de barras do tempo de estudo ${serie.porDia ? 'por dia' : 'por semana'}`}>
                {temTempo ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie.pontos} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid vertical={false} stroke="var(--c-linha)" strokeOpacity={0.6} />
                      <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                      <YAxis tick={eixo} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(m: number) => (m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`)} />
                      <Tooltip content={<Dica tipo="tempo" />} cursor={{ fill: 'var(--c-nevoa)', fillOpacity: 0.5 }} />
                      <Bar dataKey="minutos" fill="var(--c-primaria)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="grid h-full place-items-center text-sm text-tinta-suave">Sem tempo registrado neste período.</p>
                )}
              </div>
            </Painel>
            <Painel className="p-5">
              <h3 className="font-semibold text-tinta">Acerto nas questões {serie.porDia ? 'por dia' : 'por semana'}</h3>
              <div className="mt-4 h-52" role="img" aria-label="Gráfico de linha do percentual de acerto ao longo do tempo">
                {temQuestoes ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serie.pontos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid vertical={false} stroke="var(--c-linha)" strokeOpacity={0.6} />
                      <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                      <YAxis tick={eixo} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 50, 80, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip content={<Dica tipo="acerto" />} cursor={{ stroke: 'var(--c-lilas)', strokeWidth: 1 }} />
                      <Line
                        type="monotone"
                        dataKey="acerto"
                        stroke="var(--c-primaria)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'var(--c-primaria)', stroke: 'var(--c-superficie)', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: 'var(--c-primaria)', stroke: 'var(--c-superficie)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="grid h-full place-items-center text-sm text-tinta-suave">Sem questões registradas neste período.</p>
                )}
              </div>
            </Painel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Painel className="p-5">
              <h3 className="font-semibold text-tinta">Por disciplina</h3>
              <ul className="mt-4 space-y-4">
                {porDisciplina.map((x) => (
                  <li key={x.disciplina.id}>
                    <Link to={`/edital/${x.disciplina.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-tinta group-hover:text-primaria-forte">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.disciplina.cor }} aria-hidden />
                          <span className="truncate">{x.disciplina.nome}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-tinta-suave numeros">
                          {x.tempoSegundos > 0 && formatarDuracao(x.tempoSegundos)}
                          <SeloAcerto pct={x.acertoPct} className="text-xs" />
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <BarraProgresso valor={x.progressoPct} cor={x.disciplina.cor} rotulo={`Progresso em ${x.disciplina.nome}`} />
                        <span className="w-20 shrink-0 text-right text-xs text-tinta-suave numeros">
                          {x.topicosConcluidos}/{x.topicosTotal} tópicos
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Painel>

            <Painel className="p-5">
              <h3 className="font-semibold text-tinta">Pontos de atenção</h3>
              <p className="mt-0.5 text-sm text-tinta-suave">Considera todo o seu histórico.</p>
              <h4 className="mt-4 text-sm font-semibold text-tinta">Menor acerto</h4>
              {atencao.piores.length === 0 ? (
                <p className="mt-1 text-sm text-tinta-suave">Nenhum tópico abaixo de 80% (com pelo menos 5 questões).</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {atencao.piores.map((x) => (
                    <li key={x.topico.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-tinta">{x.topico.nome}</span>
                        <span className="block truncate text-xs text-tinta-suave">{x.disciplina?.nome}</span>
                      </span>
                      <SeloAcerto pct={x.resumo!.acertoPct} />
                    </li>
                  ))}
                </ul>
              )}
              <h4 className="mt-5 text-sm font-semibold text-tinta">Há mais tempo sem estudar</h4>
              {atencao.parados.length === 0 ? (
                <p className="mt-1 text-sm text-tinta-suave">Nada por aqui ainda.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {atencao.parados.map((x) => (
                    <li key={x.topico.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-tinta">{x.topico.nome}</span>
                        <span className="block truncate text-xs text-tinta-suave">{x.disciplina?.nome}</span>
                      </span>
                      <span className="shrink-0 text-xs text-tinta-suave numeros">
                        {differenceInCalendarDays(new Date(), new Date(x.resumo!.ultimoEstudo!))} dias
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Painel>
          </div>
        </>
      )}

      <EstudoDialog aberto={adicionando} aoMudar={setAdicionando} />
    </>
  )
}
