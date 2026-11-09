import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { indiceDoDia, VERSICULOS } from '@/lib/versiculos'
import { cn } from '@/lib/utils'

export function VersiculoCard({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  const [indice, setIndice] = useState(indiceDoDia)
  const v = VERSICULOS[indice]

  const outro = () => {
    let novo = indice
    while (novo === indice) novo = Math.floor(Math.random() * VERSICULOS.length)
    setIndice(novo)
  }

  return (
    <figure
      className={cn(
        'relative overflow-hidden rounded-[28px] bg-nevoa text-tinta',
        compacto ? 'px-6 py-6' : 'px-6 py-8 sm:px-10 sm:py-10',
        className,
      )}
    >
      {/* aspas grandes como marca d'água, o único ornamento da página */}
      <span aria-hidden className="pointer-events-none absolute -top-10 right-4 font-serif text-[11rem] leading-none text-lilas/45 select-none sm:right-10 sm:text-[14rem]">
        “
      </span>
      <blockquote key={indice} className="relative animate-[aparecer_400ms_ease-out]">
        <p
          className={cn(
            'max-w-[46ch] font-serif italic text-tinta [text-wrap:pretty]',
            compacto ? 'text-lg leading-relaxed' : 'text-[1.35rem] leading-[1.55] sm:text-[1.65rem] sm:leading-[1.5]',
          )}
        >
          {v.texto}
        </p>
      </blockquote>
      <figcaption className="relative mt-4 flex items-center justify-between gap-4">
        <cite className="not-italic text-[15px] font-semibold text-primaria-forte">{v.referencia}</cite>
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
