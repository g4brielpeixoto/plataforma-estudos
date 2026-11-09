import { ClipboardCheck, Clock, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { ROTULOS_PERIODO, type Indicadores, type Periodo, type PeriodoPreset } from '@/lib/indicadores'
import { cn, formatarDuracao, nivelAcerto, textoNivel } from '@/lib/utils'
import { BarraProgresso, Entrada } from './ui'

function Bloco({ icone, titulo, valor, detalhe, extra }: { icone: ReactNode; titulo: string; valor: ReactNode; detalhe: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-tinta-suave">
        <span className="text-lavanda">{icone}</span>
        {titulo}
      </div>
      <div className="mt-1 text-[2rem] leading-none font-semibold tracking-tight text-tinta numeros">{valor}</div>
      <div className="text-sm text-tinta-suave numeros">{detalhe}</div>
      {extra}
    </div>
  )
}

/** Os três indicadores principais: Tempo de estudo, Desempenho e Progresso no edital */
export function PainelIndicadores({ dados, className }: { dados: Indicadores; className?: string }) {
  const nivel = nivelAcerto(dados.acertoPct)
  return (
    <div className={cn('grid divide-y divide-linha/70 rounded-2xl border border-linha/70 bg-superficie md:grid-cols-3 md:divide-x md:divide-y-0', className)}>
      <Bloco
        icone={<Clock className="size-4" aria-hidden />}
        titulo="Tempo de estudo"
        valor={formatarDuracao(dados.tempoSegundos)}
        detalhe={dados.sessoes === 1 ? '1 sessão no período' : `${dados.sessoes} sessões no período`}
      />
      <Bloco
        icone={<Target className="size-4" aria-hidden />}
        titulo="Desempenho"
        valor={
          <span className="flex items-baseline gap-2">
            <span className={cn(nivel && textoNivel[nivel])}>{dados.acertoPct === null ? '—' : `${dados.acertoPct}%`}</span>
            <span className="text-base font-medium text-tinta-suave">
              {dados.questoesFeitas} {dados.questoesFeitas === 1 ? 'questão' : 'questões'}
            </span>
          </span>
        }
        detalhe={`${dados.questoesAcertadas} certas · ${dados.questoesErradas} erradas`}
      />
      <Bloco
        icone={<ClipboardCheck className="size-4" aria-hidden />}
        titulo="Progresso no edital"
        valor={
          <span className="flex items-baseline gap-2">
            {dados.progressoPct === null ? '—' : `${dados.progressoPct}%`}
            <span className="text-base font-medium text-tinta-suave">
              {dados.topicosConcluidos} de {dados.topicosTotal}
            </span>
          </span>
        }
        detalhe={dados.topicosPendentes === 1 ? '1 tópico pendente' : `${dados.topicosPendentes} tópicos pendentes`}
        extra={<BarraProgresso valor={dados.progressoPct} className="mt-2" rotulo="Progresso no edital" />}
      />
    </div>
  )
}

const PRESETS: PeriodoPreset[] = ['hoje', '7d', '30d', 'tudo', 'personalizado']

export function FiltroPeriodo({ valor, aoMudar }: { valor: Periodo; aoMudar: (p: Periodo) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Período" className="inline-flex max-w-full overflow-x-auto rounded-xl bg-superficie-2 p-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={valor.preset === p}
            onClick={() => aoMudar({ ...valor, preset: p })}
            className={cn(
              'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3',
              valor.preset === p ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta',
            )}
          >
            {ROTULOS_PERIODO[p]}
          </button>
        ))}
      </div>
      {valor.preset === 'personalizado' && (
        <div className="flex items-center gap-2 text-sm text-tinta-suave">
          <Entrada type="date" aria-label="De" className="h-9 w-auto" value={valor.inicio ?? ''} onChange={(e) => aoMudar({ ...valor, inicio: e.target.value })} />
          até
          <Entrada type="date" aria-label="Até" className="h-9 w-auto" value={valor.fim ?? ''} onChange={(e) => aoMudar({ ...valor, fim: e.target.value })} />
        </div>
      )}
    </div>
  )
}
