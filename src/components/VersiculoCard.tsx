import { useEffect, useState } from 'react'
import { dataBrasilia, indiceDoDia, VERSICULOS } from '@/lib/versiculos'
import { cn } from '@/lib/utils'

/** Versículo do dia (horário de Brasília); troca sozinho à meia-noite se a página ficar aberta */
function useVersiculoDoDia() {
  const [dia, setDia] = useState(() => dataBrasilia())
  const [indice, setIndice] = useState(() => indiceDoDia())

  // se a página ficar aberta, troca para o versículo do novo dia à meia-noite de Brasília
  useEffect(() => {
    const id = window.setInterval(() => {
      const hoje = dataBrasilia()
      if (hoje !== dia) {
        setDia(hoje)
        setIndice(indiceDoDia())
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [dia])
  return { v: VERSICULOS[indice], indice }
}

/** Versículo em formato de card pequeno, para a linha de resumos da página inicial */
export function VersiculoMini({ className }: { className?: string }) {
  const { v, indice } = useVersiculoDoDia()
  return (
    <figure className={cn('relative flex flex-col justify-center overflow-hidden rounded-2xl border border-linha/70 bg-nevoa/70 px-5 pt-9 pb-5', className)}>
      <span aria-hidden className="pointer-events-none absolute top-1 left-4 text-[4.5rem] leading-none text-lilas select-none">
        “
      </span>
      <blockquote key={indice} className="relative animate-[aparecer_400ms_ease-out]">
        <p className="text-center text-[0.97rem] leading-relaxed text-tinta italic [text-wrap:pretty]">{v.texto}</p>
      </blockquote>
      <figcaption className="relative mt-2 text-center text-sm font-semibold text-primaria-forte dark:text-primaria">{v.referencia}</figcaption>
    </figure>
  )
}

export function VersiculoCard({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  const { v, indice } = useVersiculoDoDia()

  return (
    <figure
      className={cn(
        'relative overflow-hidden rounded-[28px] bg-nevoa text-tinta',
        compacto ? 'px-6 py-6' : 'px-6 py-6 sm:px-8 sm:py-7',
        className,
      )}
    >
      {/* aspas grandes como marca d'água, o único ornamento da página */}
      <span aria-hidden className="pointer-events-none absolute -top-7 right-4 text-[8rem] leading-none text-lilas/45 select-none sm:right-8 sm:text-[10rem]">
        “
      </span>
      <blockquote key={indice} className="relative animate-[aparecer_400ms_ease-out]">
        <p
          className={cn(
            'max-w-[46ch] italic text-tinta [text-wrap:pretty]',
            compacto ? 'text-base leading-relaxed' : 'text-[1.08rem] leading-[1.6] sm:text-[1.2rem] sm:leading-[1.6]',
          )}
        >
          {v.texto}
        </p>
      </blockquote>
      <figcaption className="relative mt-3">
        <cite className="not-italic text-sm font-semibold text-primaria-forte">{v.referencia}</cite>
      </figcaption>
    </figure>
  )
}
