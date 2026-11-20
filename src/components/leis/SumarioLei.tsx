import { Check, Menu, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { textoPuro } from '@/lib/flashcards/html'
import { COR_INCIDENCIA, ROTULO_INCIDENCIA, rotuloSumario, type EntradaSumario } from '@/lib/leis'
import { cn } from '@/lib/utils'
import type { LeiLinha } from '@/types'

/** Sumário da lei: clicar leva à linha; a bolinha é a incidência e o ✓ marca o que já foi revisado */
export function SumarioLei({
  entradas,
  linhaPorId,
  ativa,
  aoIr,
  aoFechar,
  className,
}: {
  entradas: EntradaSumario[]
  linhaPorId: Map<string, LeiLinha>
  /** a entrada que está na tela */
  ativa: string | null
  aoIr: (id: string) => void
  aoFechar: () => void
  className?: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const artigos = entradas.filter((e) => !e.divisao).length

  // mantém a entrada ativa à vista dentro do sumário (sem rolar a página)
  useEffect(() => {
    const c = caixa.current
    const el = ativa ? c?.querySelector<HTMLElement>(`[data-sumario="${ativa}"]`) : null
    if (!c || !el) return
    const topo = el.offsetTop - c.offsetTop
    if (topo < c.scrollTop + 8) c.scrollTop = topo - 8
    else if (topo + el.offsetHeight > c.scrollTop + c.clientHeight - 8) c.scrollTop = topo + el.offsetHeight - c.clientHeight + 8
  }, [ativa])

  return (
    <nav aria-label="Sumário da lei" className={cn('flex min-h-0 flex-col rounded-2xl border border-linha/70 bg-superficie', className)}>
      <div className="flex items-center gap-2 border-b border-linha/70 py-2 pr-2 pl-4">
        <Menu className="size-4 shrink-0 text-tinta-suave" aria-hidden />
        <p className="min-w-0 flex-1 truncate font-medium text-tinta numeros">
          Sumário <span className="font-normal text-tinta-suave">({artigos} {artigos === 1 ? 'artigo' : 'artigos'})</span>
        </p>
        <button type="button" onClick={aoFechar} aria-label="Esconder o sumário" title="Esconder o sumário" className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-superficie-2 hover:text-tinta">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div ref={caixa} className="relative min-h-0 flex-1 overflow-y-auto p-2">
        {entradas.length === 0 ? (
          <p className="px-2 py-3 text-sm text-tinta-suave">As linhas da lei aparecem aqui.</p>
        ) : (
          <ul>
            {entradas.map((e) => {
              const l = linhaPorId.get(e.id)
              if (!l) return null
              const rotulo = rotuloSumario(textoPuro(l.texto)) || 'Linha sem texto'
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    data-sumario={e.id}
                    onClick={() => aoIr(e.id)}
                    aria-current={ativa === e.id ? 'location' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm hover:bg-superficie-2',
                      ativa === e.id ? 'bg-nevoa/70 font-medium text-tinta' : e.divisao ? 'font-medium text-tinta' : 'text-tinta-suave',
                    )}
                    style={{ paddingLeft: `${0.5 + e.nivel * 0.75}rem` }}
                  >
                    <span
                      className={cn('size-2 shrink-0 rounded-full', !l.incidencia && 'border border-linha')}
                      style={l.incidencia ? { background: COR_INCIDENCIA[l.incidencia] } : undefined}
                      title={l.incidencia ? `Incidência ${ROTULO_INCIDENCIA[l.incidencia].toLowerCase()}` : undefined}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                    {l.incidencia && <span className="sr-only">, incidência {ROTULO_INCIDENCIA[l.incidencia].toLowerCase()}</span>}
                    {l.revisado_em && (
                      <>
                        <Check className="size-3.5 shrink-0 text-visto" aria-hidden />
                        <span className="sr-only">, revisado</span>
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </nav>
  )
}
