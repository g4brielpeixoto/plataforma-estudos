import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dataBrasilia, indiceDoDia, VERSICULOS } from '@/lib/versiculos'
import { cn } from '@/lib/utils'

export function VersiculoCard({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  const [dia, setDia] = useState(() => dataBrasilia())
  const [indice, setIndice] = useState(() => indiceDoDia())
  const v = VERSICULOS[indice]

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

  const outro = () => {
    let novo = indice
    while (novo === indice) novo = Math.floor(Math.random() * VERSICULOS.length)
    setIndice(novo)
  }

  return (
    <figure
      className={cn(
        'relative overflow-hidden rounded-[28px] bg-nevoa text-tinta',
        compacto ? 'px-6 py-6' : 'px-6 py-6 sm:px-8 sm:py-7',
        className,
      )}
    >
      {/* aspas grandes como marca d'água, o único ornamento da página */}
      <span aria-hidden className="pointer-events-none absolute -top-7 right-4 font-serif text-[8rem] leading-none text-lilas/45 select-none sm:right-8 sm:text-[10rem]">
        “
      </span>
      <blockquote key={indice} className="relative animate-[aparecer_400ms_ease-out]">
        <p
          className={cn(
            'max-w-[46ch] font-serif italic text-tinta [text-wrap:pretty]',
            compacto ? 'text-base leading-relaxed' : 'text-[1.08rem] leading-[1.6] sm:text-[1.2rem] sm:leading-[1.6]',
          )}
        >
          {v.texto}
        </p>
      </blockquote>
      <figcaption className="relative mt-3 flex items-center justify-between gap-4">
        <cite className="not-italic text-sm font-semibold text-primaria-forte">{v.referencia}</cite>
        {!compacto && (
          <button
            onClick={outro}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-tinta-suave hover:bg-perola/70 hover:text-tinta"
          >
            <RefreshCw className="size-4" aria-hidden />
            Outro versículo
          </button>
        )}
      </figcaption>
    </figure>
  )
}
