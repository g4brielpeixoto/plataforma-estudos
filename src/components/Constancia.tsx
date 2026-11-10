import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Flame } from 'lucide-react'
import { useMemo } from 'react'
import { calcularSequencia, chaveDia, diaConta, minutosPorDia, MINUTOS_PARA_CONTAR } from '@/lib/constancia'
import { cn, formatarDuracao } from '@/lib/utils'
import type { Estudo } from '@/types'
import { Painel } from './ui'

/** Quantos dias seguidos a pessoa estudou (dia conta a partir de 20 min) */
export function Constancia({ estudos, className }: { estudos: Estudo[]; className?: string }) {
  const mapa = useMemo(() => minutosPorDia(estudos), [estudos])
  const seq = useMemo(() => calcularSequencia(mapa), [mapa])
  const hoje = new Date()
  const ultimos = Array.from({ length: 14 }, (_, i) => subDays(hoje, 13 - i))
  const minutosHoje = mapa.get(chaveDia(hoje)) ?? 0
  const prefixoMes = format(hoje, 'yyyy-MM')
  let diasNoMes = 0
  let diasTotal = 0
  for (const [k, m] of mapa) {
    if (!diaConta(m)) continue
    diasTotal++
    if (k.startsWith(prefixoMes)) diasNoMes++
  }

  return (
    <Painel className={cn('p-5 sm:p-6', className)}>
      <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Constância de estudos</h2>

      <div className="mt-4 flex items-center gap-4">
        <div className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', seq.atual > 0 ? 'bg-nevoa text-primaria-forte dark:text-primaria' : 'bg-superficie-2 text-tinta-suave')}>
          <Flame className="size-7" aria-hidden />
        </div>
        <div>
          <p className="text-[2rem] leading-none font-semibold tracking-tight text-tinta numeros">
            {seq.atual} <span className="text-lg font-medium text-tinta-suave">{seq.atual === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          </p>
          <p className="mt-1.5 text-sm text-tinta-suave numeros">Recorde: {seq.recorde} {seq.recorde === 1 ? 'dia' : 'dias'}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="grid grid-cols-14 gap-1" aria-label="Últimos 14 dias">
          {ultimos.map((d) => {
            const min = mapa.get(chaveDia(d))
            const conta = diaConta(min)
            const ehHoje = chaveDia(d) === chaveDia(hoje)
            return (
              <div key={chaveDia(d)} className="flex flex-col items-center gap-1">
                <span
                  title={`${format(d, "EEE, d 'de' MMM", { locale: ptBR })}: ${min ? formatarDuracao(min * 60) : 'sem estudo'}`}
                  aria-label={`${format(d, "d 'de' MMMM", { locale: ptBR })}: ${conta ? 'estudou' : 'não contou'}`}
                  className={cn(
                    'aspect-square w-full max-w-7 rounded-md',
                    conta ? 'bg-primaria' : 'bg-superficie-2',
                    ehHoje && !conta && 'ring-2 ring-lilas ring-inset',
                  )}
                />
                <span className={cn('text-[11px] leading-none', ehHoje ? 'font-semibold text-tinta' : 'text-tinta-suave')}>
                  {format(d, 'EEEEE', { locale: ptBR }).toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-superficie-2 px-3 py-2.5">
          <dt className="text-xs text-tinta-suave">Dias estudados no mês</dt>
          <dd className="mt-0.5 text-lg font-semibold text-tinta numeros">
            {diasNoMes} <span className="text-sm font-normal text-tinta-suave">de {hoje.getDate()}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-superficie-2 px-3 py-2.5">
          <dt className="text-xs text-tinta-suave">Dias estudados no total</dt>
          <dd className="mt-0.5 text-lg font-semibold text-tinta numeros">{diasTotal}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-tinta-suave numeros">
        {seq.hojeConta
          ? 'Hoje já conta para a sequência.'
          : minutosHoje > 0
            ? `Hoje: ${formatarDuracao(minutosHoje * 60)}. Faltam ${Math.ceil(MINUTOS_PARA_CONTAR - minutosHoje)} min para contar.`
            : `Estude ${MINUTOS_PARA_CONTAR} min hoje para ${seq.atual > 0 ? 'manter' : 'começar'} a sequência.`}
      </p>
    </Painel>
  )
}
