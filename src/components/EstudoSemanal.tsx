import { eachDayOfInterval, format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chaveDia } from '@/lib/constancia'
import { estudosEm, semana, somarEstudos, variacaoPct, type Intervalo } from '@/lib/periodos'
import { cn, formatarHorasMinutos, porcentagem } from '@/lib/utils'
import type { Estudo } from '@/types'

type Modo = 'tempo' | 'questoes'

const eixo = { fontSize: 12, fill: 'var(--c-tinta-suave)' }
const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

/** Rótulo do eixo de tempo: 30m, 1h, 1h30 */
function rotuloTempo(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Marcas do eixo de tempo em passos redondos (15 min, 30 min, 1h, 2h…) */
function marcasTempo(maximo: number) {
  const passos = [15, 30, 60, 120, 180, 240]
  const passo = passos.find((p) => maximo / p <= 5) ?? 300
  const topo = Math.max(passo, Math.ceil(maximo / passo) * passo)
  return Array.from({ length: topo / passo + 1 }, (_, i) => i * passo)
}

/** Tempo ou questões por dia da semana (segunda a domingo), com navegação entre semanas */
export function EstudoSemanal({ estudos, className }: { estudos: Estudo[]; className?: string }) {
  const [deslocamento, setDeslocamento] = useState(0)
  const [modo, setModo] = useState<Modo>('tempo')

  const dados = useMemo(() => {
    const atual = semana(deslocamento)
    // na semana corrente, compara com o mesmo trecho da semana passada; nas outras, com a semana inteira
    const base = semana(deslocamento + 1)
    const anterior: Intervalo = deslocamento === 0 ? { de: base.de, ate: new Date(Date.now() - 7 * 86_400_000) } : base
    const daSemana = estudosEm(estudos, atual)
    const porDia = new Map<string, { minutos: number; feitas: number; acertadas: number }>()
    for (const e of daSemana) {
      const k = chaveDia(new Date(e.data_hora))
      const d = porDia.get(k) ?? { minutos: 0, feitas: 0, acertadas: 0 }
      d.minutos += (e.duracao_segundos ?? 0) / 60
      d.feitas += e.questoes_feitas ?? 0
      d.acertadas += e.questoes_acertadas ?? 0
      porDia.set(k, d)
    }
    const pontos = eachDayOfInterval({ start: atual.de, end: atual.ate }).map((d, i) => {
      const v = porDia.get(chaveDia(d)) ?? { minutos: 0, feitas: 0, acertadas: 0 }
      return {
        rotulo: DIAS[i],
        dica: format(d, "EEEE, d 'de' MMM", { locale: ptBR }),
        hoje: isToday(d),
        minutos: Math.round(v.minutos),
        feitas: v.feitas,
        acertadas: v.acertadas,
      }
    })
    return { atual, pontos, total: somarEstudos(daSemana), antes: somarEstudos(estudosEm(estudos, anterior)) }
  }, [estudos, deslocamento])

  const chave = modo === 'tempo' ? 'minutos' : 'feitas'
  const maximo = Math.max(0, ...dados.pontos.map((p) => p[chave]))
  const ticks = modo === 'tempo' ? marcasTempo(maximo) : undefined
  const vazio = maximo === 0

  const variacao = modo === 'tempo' ? variacaoPct(dados.total.segundos, dados.antes.segundos) : variacaoPct(dados.total.feitas, dados.antes.feitas)
  const acerto = porcentagem(dados.total.acertadas, dados.total.feitas)

  return (
    <section className={cn('rounded-2xl border border-linha/70 bg-superficie p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Estudo semanal</h2>
        <div className="flex items-center gap-1 text-sm text-tinta-suave numeros">
          <button onClick={() => setDeslocamento((d) => d + 1)} aria-label="Semana anterior" className="grid size-7 place-items-center rounded-md hover:bg-superficie-2">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="font-medium text-tinta">{format(dados.atual.de, 'dd/MM')}</span>
          <span aria-hidden>~</span>
          <span className="font-medium text-tinta">{format(dados.atual.ate, 'dd/MM')}</span>
          <button onClick={() => setDeslocamento((d) => Math.max(0, d - 1))} disabled={deslocamento === 0} aria-label="Próxima semana" className="grid size-7 place-items-center rounded-md hover:bg-superficie-2 disabled:opacity-30">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <div role="tablist" aria-label="Mostrar" className="inline-flex rounded-xl bg-superficie-2 p-1">
          {(['tempo', 'questoes'] as Modo[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors', modo === m ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta')}
            >
              {m === 'tempo' ? 'Tempo' : 'Questões'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56" role="img" aria-label={`Gráfico de barras: ${modo === 'tempo' ? 'tempo de estudo' : 'questões resolvidas'} por dia, de ${format(dados.atual.de, 'dd/MM')} a ${format(dados.atual.ate, 'dd/MM')}`}>
        {vazio ? (
          <p className="grid h-full place-items-center rounded-xl bg-superficie-2/60 text-sm text-tinta-suave">
            {modo === 'tempo' ? 'Nenhum tempo registrado nesta semana.' : 'Nenhuma questão registrada nesta semana.'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.pontos} margin={{ top: 22, right: 4, bottom: 0, left: -14 }}>
              <CartesianGrid vertical={false} stroke="var(--c-linha)" strokeDasharray="4 4" />
              <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={{ stroke: 'var(--c-linha)' }} interval={0} />
              <YAxis
                tick={eixo}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                ticks={ticks}
                domain={ticks ? [0, ticks[ticks.length - 1]] : [0, 'auto']}
                tickFormatter={modo === 'tempo' ? rotuloTempo : undefined}
              />
              <Tooltip
                cursor={{ fill: 'var(--c-nevoa)', fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof dados.pontos)[number]
                  return (
                    <div className="rounded-xl border border-linha bg-superficie px-3 py-2 text-sm shadow-lg">
                      <p className="font-medium text-tinta">{p.dica}</p>
                      <p className="text-tinta-suave numeros">
                        {modo === 'tempo'
                          ? `${formatarHorasMinutos(p.minutos * 60)} de estudo`
                          : p.feitas
                            ? `${p.acertadas} de ${p.feitas} questões (${porcentagem(p.acertadas, p.feitas)}%)`
                            : 'Sem questões'}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey={chave} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                {dados.pontos.map((p) => (
                  <Cell key={p.rotulo} fill={p.hoje ? 'var(--c-primaria)' : 'var(--c-lavanda)'} />
                ))}
                <LabelList
                  dataKey={chave}
                  position="top"
                  offset={6}
                  className="numeros"
                  style={{ fontSize: 12, fontWeight: 600, fill: 'var(--c-tinta)' }}
                  formatter={(v: unknown) => (Number(v) > 0 ? (modo === 'tempo' ? formatarHorasMinutos(Number(v) * 60) : String(v)) : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-superficie-2/70 px-4 py-3">
        <div>
          <p className="text-sm text-tinta-suave">{modo === 'tempo' ? 'Total estudado' : 'Questões resolvidas'}</p>
          <p className="text-lg leading-tight font-semibold text-tinta numeros">
            {modo === 'tempo' ? formatarHorasMinutos(dados.total.segundos) : dados.total.feitas}
            {modo === 'questoes' && acerto !== null && <span className="ml-1.5 text-sm font-medium text-tinta-suave">{acerto}% de acerto</span>}
          </p>
        </div>
        {variacao !== null && (
          <div className="flex shrink-0 items-center gap-1.5 text-right" title={deslocamento === 0 ? 'Comparado com a semana passada até o mesmo dia e hora' : undefined}>
            {variacao >= 0 ? <ArrowUp className="size-4 text-bom" aria-hidden /> : <ArrowDown className="size-4 text-ruim" aria-hidden />}
            <p className="leading-tight">
              <span className={cn('font-semibold numeros', variacao >= 0 ? 'text-bom' : 'text-ruim')}>{Math.abs(variacao)}%</span>
              <span className="block text-sm text-tinta-suave">vs. semana anterior</span>
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
