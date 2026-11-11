import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEffect, useMemo, useRef, useState } from 'react'
import { chaveDia, minutosPorDia, nivelCalor, ROTULOS_CALOR, semanasDoAno } from '@/lib/constancia'
import { cn, formatarDuracao } from '@/lib/utils'
import type { Estudo } from '@/types'
import { Painel } from './ui'

const ESPACO = 3
const DIAS_SEMANA = ['', 'Seg', '', 'Qua', '', 'Sex', '']

/** Mapa de calor dos últimos 12 meses: quanto mais escuro, mais horas no dia */
export function MapaCalor({ estudos, className }: { estudos: Estudo[]; className?: string }) {
  const mapa = useMemo(() => minutosPorDia(estudos), [estudos])
  const semanas = useMemo(() => semanasDoAno(), [])
  const rolagem = useRef<HTMLDivElement>(null)
  const [selecionado, setSelecionado] = useState<Date | null>(null)
  const [CELULA, setCelula] = useState(13)

  // células crescem para ocupar a largura no computador; no celular ficam pequenas e a área rola
  useEffect(() => {
    const el = rolagem.current
    if (!el) return
    const medir = () => setCelula(Math.max(11, Math.min(28, Math.floor(el.clientWidth / semanas.length) - ESPACO)))
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [semanas.length])

  // começa mostrando os meses mais recentes (à direita)
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollLeft = rolagem.current.scrollWidth
  }, [CELULA])

  const resumo = useMemo(() => {
    let dias = 0
    let minutos = 0
    for (const semana of semanas)
      for (const d of semana) {
        if (!d) continue
        const m = mapa.get(chaveDia(d)) ?? 0
        minutos += m
        if (nivelCalor(m) > 0) dias++
      }
    return { dias, minutos }
  }, [semanas, mapa])

  // rótulo do mês na coluna da semana que contém o dia 1
  const meses = semanas.map((semana) => {
    const primeiro = semana.find((d) => d && d.getDate() === 1)
    return primeiro ? format(primeiro, 'MMM', { locale: ptBR }).replace('.', '') : ''
  })

  const largura = semanas.length * (CELULA + ESPACO)
  const minSel = selecionado ? (mapa.get(chaveDia(selecionado)) ?? 0) : 0

  return (
    <Painel className={cn('p-5 sm:p-6', className)}>
      <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Heatmap de estudos</h2>
      <p className="mt-1 max-w-prose text-sm text-tinta-suave">
        Intensidade de estudo ao longo do ano — quanto mais <span className="dark:hidden">escuro</span><span className="hidden dark:inline">forte a cor</span>, mais horas. Um dia conta a partir de 20 minutos, como no calendário.
      </p>

      <div className="mt-5 flex gap-2">
        {/* dias da semana */}
        <div className="shrink-0 pt-[18px]" aria-hidden>
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-[11px] leading-none text-tinta-suave" style={{ height: CELULA, marginBottom: ESPACO }}>
              <span className="relative top-px">{d}</span>
            </div>
          ))}
        </div>

        <div ref={rolagem} className="min-w-0 flex-1 overflow-x-auto pb-2 [scrollbar-width:thin]">
          <div style={{ width: largura }}>
            <div className="flex h-[18px] text-[11px] leading-none text-tinta-suave" aria-hidden>
              {meses.map((m, i) => (
                <div key={i} style={{ width: CELULA + ESPACO }} className="shrink-0 overflow-visible whitespace-nowrap">
                  {m}
                </div>
              ))}
            </div>
            <div
              role="img"
              aria-label={`Mapa de calor dos últimos 12 meses: ${resumo.dias} dias estudados, ${formatarDuracao(resumo.minutos * 60)} no total.`}
              className="flex"
              style={{ gap: ESPACO }}
              onMouseLeave={() => setSelecionado(null)}
            >
              {semanas.map((semana, i) => (
                <div key={i} className="flex flex-col" style={{ gap: ESPACO }}>
                  {semana.map((d, j) => {
                    if (!d) return <div key={j} style={{ width: CELULA, height: CELULA }} />
                    const nivel = nivelCalor(mapa.get(chaveDia(d)))
                    const ativo = selecionado && chaveDia(selecionado) === chaveDia(d)
                    return (
                      <div
                        key={j}
                        onMouseEnter={() => setSelecionado(d)}
                        onClick={() => setSelecionado(d)}
                        className={cn('cursor-pointer rounded-[3px]', ativo && 'ring-2 ring-tinta/70 ring-offset-1 ring-offset-superficie')}
                        style={{ width: CELULA, height: CELULA, background: `var(--c-calor-${nivel})` }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-tinta-suave">
        <p aria-live="polite" className="numeros">
          {selecionado ? (
            <>
              <span className="font-medium text-tinta">{format(selecionado, "EEE, d 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
              {' · '}
              {minSel > 0 ? formatarDuracao(minSel * 60) : 'sem estudo'}
            </>
          ) : (
            <>
              <span className="font-medium text-tinta">{resumo.dias}</span> {resumo.dias === 1 ? 'dia estudado' : 'dias estudados'} em 12 meses ·{' '}
              <span className="font-medium text-tinta">{formatarDuracao(resumo.minutos * 60)}</span> no total
            </>
          )}
        </p>
        <div className="flex items-center gap-1.5 text-xs" aria-label="Legenda">
          Menos
          {ROTULOS_CALOR.map((r, i) => (
            <span key={r} title={r} className="inline-block rounded-[3px]" style={{ width: 11, height: 11, background: `var(--c-calor-${i})` }} />
          ))}
          Mais
        </div>
      </div>
    </Painel>
  )
}
