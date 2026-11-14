import { startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { cn, formatarHorasMinutos } from '@/lib/utils'
import type { Disciplina, Estudo } from '@/types'
import { Painel } from './ui'

type Aba = 'hoje' | 'semana' | 'mes' | 'total'

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'total', rotulo: 'Total' },
]

const COMPARACAO: Record<Exclude<Aba, 'total'>, string> = {
  hoje: 'em relação a ontem',
  semana: 'em relação à semana passada, até o mesmo dia',
  mes: 'em relação ao mês passado, até o mesmo dia',
}

/** Intervalo atual e o equivalente anterior (mesmo trecho do período passado) */
function intervalos(aba: Aba, agora = new Date()) {
  if (aba === 'hoje') {
    const de = startOfDay(agora)
    return { atual: [de, agora], anterior: [subDays(de, 1), de] } as const
  }
  if (aba === 'semana') {
    const de = startOfWeek(agora, { weekStartsOn: 1 })
    return { atual: [de, agora], anterior: [subWeeks(de, 1), subWeeks(agora, 1)] } as const
  }
  if (aba === 'mes') {
    const de = startOfMonth(agora)
    const dePassado = subMonths(de, 1)
    // mesmo número de dias do mês passado (sem passar do fim dele)
    const fimPassado = new Date(Math.min(subMonths(agora, 1).getTime(), de.getTime() - 1))
    return { atual: [de, agora], anterior: [dePassado, fimPassado] } as const
  }
  return { atual: [new Date(0), agora], anterior: null }
}

function somar(estudos: Estudo[], de: Date, ate: Date) {
  const a = de.getTime()
  const b = ate.getTime()
  return estudos.filter((e) => {
    const t = new Date(e.data_hora).getTime()
    return t >= a && t < b + 1
  })
}

/** Tempo de estudo do dia, da semana, do mês e total, dividido por disciplina */
export function TempoPizza({ estudos, disciplinas, className }: { estudos: Estudo[]; disciplinas: Disciplina[]; className?: string }) {
  const [aba, setAba] = useState<Aba>('hoje')

  const dados = useMemo(() => {
    const { atual, anterior } = intervalos(aba)
    const doPeriodo = somar(estudos, atual[0], atual[1])
    const porDisciplina = new Map<string, number>()
    for (const e of doPeriodo) {
      if (!e.duracao_segundos) continue
      const d = e.disciplina_id
      porDisciplina.set(d, (porDisciplina.get(d) ?? 0) + e.duracao_segundos)
    }
    const fatias = disciplinas
      .filter((d) => (porDisciplina.get(d.id) ?? 0) > 0)
      .map((d) => ({ id: d.id, nome: d.nome, cor: d.cor, segundos: porDisciplina.get(d.id)! }))
      .sort((a, b) => b.segundos - a.segundos)
    const total = fatias.reduce((s, f) => s + f.segundos, 0)

    let variacao: number | null = null
    if (anterior) {
      const antes = somar(estudos, anterior[0], anterior[1]).reduce((s, e) => s + (e.duracao_segundos ?? 0), 0)
      if (antes > 0 && total > 0) variacao = Math.round(((total - antes) / antes) * 100)
    }
    return { fatias, total, variacao }
  }, [aba, estudos, disciplinas])

  const subiu = dados.variacao !== null && dados.variacao >= 0

  return (
    <Painel className={cn('flex flex-col p-5 sm:p-6', className)}>
      <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Tempo de estudo</h2>

      <div role="tablist" aria-label="Período do tempo de estudo" className="mx-auto mt-4 grid w-full max-w-xs grid-cols-4 rounded-xl bg-superficie-2 p-1">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            role="tab"
            aria-selected={aba === a.valor}
            onClick={() => setAba(a.valor)}
            className={cn('rounded-lg py-1.5 text-sm font-medium transition-colors', aba === a.valor ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta')}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-5 aspect-square w-full max-w-[15rem]" role="img" aria-label={`Tempo por disciplina: ${dados.fatias.map((f) => `${f.nome} ${formatarHorasMinutos(f.segundos)}`).join(', ') || 'nenhum estudo'}`}>
        {dados.total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dados.fatias}
                dataKey="segundos"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="var(--c-superficie)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {dados.fatias.map((f) => (
                  <Cell key={f.id} fill={f.cor} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl border border-linha bg-superficie px-3 py-2 text-sm shadow-lg">
                      <p className="font-medium text-tinta">{String(payload[0].name)}</p>
                      <p className="text-tinta-suave numeros">
                        {formatarHorasMinutos(Number(payload[0].value))} · {Math.round((Number(payload[0].value) / dados.total) * 100)}%
                      </p>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid size-full place-items-center rounded-full bg-superficie-2">
            <p className="px-8 text-center text-sm text-tinta-suave">{aba === 'hoje' ? 'Nenhum estudo hoje ainda' : 'Nenhum estudo no período'}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <p className="text-[1.9rem] leading-none font-semibold tracking-tight text-tinta numeros">{formatarHorasMinutos(dados.total)}</p>
        {aba !== 'total' && dados.variacao !== null && (
          <span
            title={COMPARACAO[aba]}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold numeros', subiu ? 'bg-bom-fundo text-bom' : 'bg-ruim-fundo text-ruim')}
          >
            {subiu ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
            {Math.abs(dados.variacao)}%<span className="sr-only"> {COMPARACAO[aba]}</span>
          </span>
        )}
      </div>
      {aba !== 'total' && dados.variacao !== null && <p className="mt-1 text-center text-xs text-tinta-suave">{COMPARACAO[aba]}</p>}

      {dados.fatias.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {dados.fatias.map((f) => (
            <li key={f.id} className="flex items-center gap-3 text-[15px]">
              <span className="size-4 shrink-0 rounded-[5px]" style={{ background: f.cor }} aria-hidden />
              <span className="min-w-0 truncate text-tinta">{f.nome}</span>
              <span className="min-w-4 flex-1 border-b border-dashed border-linha" aria-hidden />
              <span className="shrink-0 text-tinta-suave numeros">{formatarHorasMinutos(f.segundos)}</span>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  )
}
