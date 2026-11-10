import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp, Flame } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { calcularSequencia, chaveDia, diaConta, minutosPorDia, MINUTOS_PARA_CONTAR } from '@/lib/constancia'
import { cn, formatarDuracao } from '@/lib/utils'
import type { Estudo } from '@/types'

/** Faixa larga com a sequência de dias estudados e um quadradinho por dia */
export function Constancia({ estudos, aoVerDetalhes, className }: { estudos: Estudo[]; aoVerDetalhes?: () => void; className?: string }) {
  const mapa = useMemo(() => minutosPorDia(estudos), [estudos])
  const seq = useMemo(() => calcularSequencia(mapa), [mapa])
  const primeiroDia = useMemo(() => [...mapa.keys()].sort()[0] ?? null, [mapa])

  // quantos dias cabem na largura do card (até 31)
  const faixa = useRef<HTMLDivElement>(null)
  const [qtd, setQtd] = useState(30)
  const [tamanho, setTamanho] = useState(36)
  useEffect(() => {
    const el = faixa.current
    if (!el) return
    const medir = () => {
      const largura = el.clientWidth
      const t = largura < 520 ? 30 : 38
      const espaco = largura < 520 ? 6 : 10
      setTamanho(t)
      setQtd(Math.max(7, Math.min(31, Math.floor((largura + espaco) / (t + espaco)))))
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const [deslocamento, setDeslocamento] = useState(0)
  const hoje = startOfDay(new Date())
  const fim = subDays(hoje, deslocamento * qtd)
  const inicio = subDays(fim, qtd - 1)
  const dias = eachDayOfInterval({ start: inicio, end: fim })
  const podeVoltar = primeiroDia !== null && chaveDia(inicio) > primeiroDia

  const minutosHoje = mapa.get(chaveDia(hoje)) ?? 0
  const recorde = seq.atual > 1 && seq.atual >= seq.recorde

  return (
    <section className={cn('rounded-2xl border border-linha/70 bg-superficie p-5 sm:px-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          Constância nos estudos
          <span title={`Um dia conta quando você estuda pelo menos ${MINUTOS_PARA_CONTAR} minutos.`} aria-label={`Um dia conta quando você estuda pelo menos ${MINUTOS_PARA_CONTAR} minutos.`}>
            <CircleHelp className="size-4 text-lilas" aria-hidden />
          </span>
        </h2>
        <div className="flex items-center gap-1 text-sm text-tinta-suave numeros">
          <button onClick={() => setDeslocamento((d) => d + 1)} disabled={!podeVoltar} aria-label="Dias anteriores" className="grid size-7 place-items-center rounded-md hover:bg-superficie-2 disabled:opacity-30">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="font-medium text-tinta">{format(inicio, 'dd/MM')}</span>
          <span aria-hidden>~</span>
          <span className="font-medium text-tinta">{format(fim, 'dd/MM')}</span>
          <button onClick={() => setDeslocamento((d) => Math.max(0, d - 1))} disabled={deslocamento === 0} aria-label="Dias seguintes" className="grid size-7 place-items-center rounded-md hover:bg-superficie-2 disabled:opacity-30">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[17px] text-tinta">
          <Flame className={cn('size-5', seq.atual > 0 ? 'text-chama' : 'text-lilas')} aria-hidden />
          {seq.atual > 0 ? (
            <>
              <strong className="font-semibold text-primaria-forte numeros dark:text-primaria">{seq.atual}</strong>
              {seq.atual === 1 ? 'dia seguido.' : 'dias seguidos.'}
              <span className="text-tinta-suave">{recorde ? 'É o seu recorde.' : `Recorde: ${seq.recorde} dias.`}</span>
            </>
          ) : (
            <>
              Nenhuma sequência ativa.
              <span className="text-tinta-suave">{seq.recorde > 0 ? `Recorde: ${seq.recorde} ${seq.recorde === 1 ? 'dia' : 'dias'}.` : ''}</span>
            </>
          )}
          {!seq.hojeConta && (
            <span className="text-sm text-tinta-suave numeros">
              {minutosHoje > 0
                ? `Faltam ${Math.ceil(MINUTOS_PARA_CONTAR - minutosHoje)} min hoje.`
                : `Estude ${MINUTOS_PARA_CONTAR} min hoje para ${seq.atual > 0 ? 'manter' : 'começar'}.`}
            </span>
          )}
        </p>
        {aoVerDetalhes && (
          <button onClick={aoVerDetalhes} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-tinta-suave hover:bg-superficie-2 hover:text-tinta">
            Ver detalhes <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div ref={faixa} className="mt-4 flex justify-between" role="list" aria-label="Dias do período">
        {dias.map((d) => {
          const k = chaveDia(d)
          const min = mapa.get(k) ?? 0
          const ehHoje = k === chaveDia(hoje)
          const antesDeComecar = !primeiroDia || k < primeiroDia
          const conta = diaConta(min)
          const rotulo = `${format(d, "EEE, d 'de' MMM", { locale: ptBR })}: ${min > 0 ? formatarDuracao(min * 60) : 'sem estudo'}${conta ? '' : min > 0 ? ' (menos de 20 min)' : ''}`
          return (
            <span
              key={k}
              role="listitem"
              title={rotulo}
              aria-label={rotulo}
              style={{ width: tamanho, height: tamanho }}
              className={cn(
                'grid shrink-0 place-items-center rounded-[10px] border',
                conta && 'border-lilas bg-nevoa text-primaria-forte dark:text-primaria',
                !conta && antesDeComecar && 'border-linha/80 bg-superficie',
                !conta && !antesDeComecar && 'border-dashed border-lilas/80 bg-superficie',
                ehHoje && !conta && 'ring-2 ring-lilas ring-offset-1 ring-offset-superficie',
              )}
            >
              {conta ? (
                <Check className="size-4" strokeWidth={2.5} aria-hidden />
              ) : !antesDeComecar ? (
                <span className={cn('rounded-full', min > 0 ? 'size-2 bg-primaria/70' : 'size-1.5 bg-lilas')} aria-hidden />
              ) : null}
            </span>
          )
        })}
      </div>
    </section>
  )
}
