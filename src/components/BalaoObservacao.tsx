import { format } from 'date-fns'
import { MessageSquareText } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { UltimaObservacao } from '@/lib/indicadores'
import { cn } from '@/lib/utils'

const LARGURA = 320
const MARGEM = 8

/**
 * Balão com a última observação escrita num estudo do tópico.
 * Abre com o mouse em cima ou com o foco; tocar/clicar deixa aberto até tocar fora (celular).
 */
export function BalaoObservacao({ obs, deOutroTopico, className }: { obs: UltimaObservacao; /** nome do subtópico, quando a observação não é do próprio tópico */ deOutroTopico?: string; className?: string }) {
  const [sobre, setSobre] = useState(false)
  const [fixo, setFixo] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; largura: number } | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const id = useId()
  const aberto = sobre || fixo

  // posiciona acima do ícone (ou abaixo, se não couber), sem sair da tela
  useLayoutEffect(() => {
    if (!aberto) return setPos(null)
    const b = botao.current?.getBoundingClientRect()
    if (!b) return
    const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM)
    const altura = caixa.current?.offsetHeight ?? 0
    const left = Math.max(MARGEM, Math.min(b.right - largura, window.innerWidth - largura - MARGEM))
    const cabeEmCima = b.top - altura - MARGEM >= MARGEM
    const top = cabeEmCima ? b.top - altura - 6 : Math.min(b.bottom + 6, window.innerHeight - altura - MARGEM)
    setPos({ left, top, largura })
  }, [aberto, obs.texto])

  useEffect(() => {
    if (!aberto) return
    const fechar = () => {
      setFixo(false)
      setSobre(false)
    }
    const fora = (e: PointerEvent) => {
      if (botao.current?.contains(e.target as Node) || caixa.current?.contains(e.target as Node)) return
      fechar()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-label="Ver a última observação"
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setSobre(true)}
        onPointerLeave={() => setSobre(false)}
        onFocus={() => setSobre(true)}
        onBlur={() => setSobre(false)}
        onClick={() => setFixo((f) => !f)}
        className={cn(
          'inline-grid size-7 shrink-0 place-items-center rounded-lg text-primaria-forte hover:bg-superficie-2 dark:text-primaria',
          aberto && 'bg-superficie-2',
          className,
        )}
      >
        <MessageSquareText className="size-4" aria-hidden />
      </button>
      {aberto &&
        createPortal(
          <div
            ref={caixa}
            id={id}
            role="tooltip"
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.largura ?? LARGURA, visibility: pos ? 'visible' : 'hidden' }}
            className="fixed z-[70] rounded-xl border border-linha bg-superficie p-3 text-left shadow-xl"
          >
            <p className="text-xs text-tinta-suave numeros">
              Última observação · {format(new Date(obs.data), 'dd/MM/yy')}
              {obs.categoria && ` · ${obs.categoria}`}
            </p>
            {deOutroTopico && <p className="mt-0.5 text-xs text-tinta-suave">Em: {deOutroTopico}</p>}
            <p className="mt-1.5 max-h-60 overflow-y-auto text-sm leading-relaxed break-words whitespace-pre-wrap text-tinta">{obs.texto}</p>
          </div>,
          document.body,
        )}
    </>
  )
}
