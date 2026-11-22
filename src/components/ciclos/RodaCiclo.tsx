import { useState } from 'react'
import type { CicloDados } from '@/hooks/useCicloDados'
import { siglaDe } from '@/lib/ciclos'
import { cn, corSobre } from '@/lib/utils'

const RAIO = 41 // % do quadro

/**
  A roda do ciclo: as disciplinas na ordem em que se revezam, com a da vez em destaque.
  Passar o mouse (ou tocar) numa disciplina mostra, no meio da roda, a próxima meta dela.
*/
export function RodaCiclo({ dados, aoAbrir, aoEditar }: { dados: CicloDados; aoAbrir: (metaId: string) => void; aoEditar: () => void }) {
  const [sobre, setSobre] = useState<number | null>(null)
  const [fixo, setFixo] = useState<number | null>(null)
  const n = dados.sequencia.length

  if (!n) {
    return (
      <div className="flex aspect-square w-full max-w-[22rem] flex-col items-center justify-center rounded-full border-2 border-dashed border-linha p-10 text-center">
        <p className="text-[15px] text-tinta-suave">A roda mostra a ordem em que as disciplinas se revezam.</p>
        <button type="button" onClick={aoEditar} className="mt-3 text-[15px] font-medium text-primaria-forte hover:underline dark:text-primaria">
          Montar o ciclo
        </button>
      </div>
    )
  }

  const tamanho = Math.min(15, ((2 * Math.PI * RAIO) / n) * 0.8) // diâmetro de cada bolinha, em % do quadro
  const ativo = fixo ?? sobre
  const posicaoMostrada = ativo ?? dados.posicao
  const disciplinaMostrada = dados.disciplinaPorId.get(dados.sequencia[posicaoMostrada])
  const metaMostrada =
    ativo === null ? dados.metaDaVez : disciplinaMostrada ? dados.proximaDe(disciplinaMostrada.id) : undefined
  const angulo = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2

  return (
    <div className="relative aspect-square w-full max-w-[24rem] [container-type:inline-size]" onMouseLeave={() => setSobre(null)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full text-linha" aria-hidden>
        <circle cx="50" cy="50" r={RAIO} fill="none" stroke="currentColor" strokeWidth="0.5" />
        {/* setinhas no sentido do ciclo, entre uma disciplina e a próxima */}
        {Array.from({ length: n }, (_, i) => {
          const a = angulo(i + 0.5)
          const x = 50 + RAIO * Math.cos(a)
          const y = 50 + RAIO * Math.sin(a)
          const graus = (a * 180) / Math.PI + 90
          return <path key={i} d="M -1 -1.2 L 1 0 L -1 1.2" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" transform={`translate(${x} ${y}) rotate(${graus - 90})`} className="text-tinta-suave/50" />
        })}
      </svg>

      {dados.sequencia.map((id, i) => {
        const d = dados.disciplinaPorId.get(id)
        if (!d) return null
        const a = angulo(i)
        const daVez = i === dados.posicao
        const prox = dados.proximaDe(id)
        return (
          <button
            key={`${id}-${i}`}
            type="button"
            onMouseEnter={() => setSobre(i)}
            onFocus={() => setSobre(i)}
            onBlur={() => setSobre(null)}
            onClick={() => setFixo((f) => (f === i ? null : i))}
            aria-pressed={fixo === i}
            aria-label={`${i + 1}º do ciclo: ${d.nome}${daVez ? ' (agora)' : ''}. ${prox ? `Próxima meta: ${prox.numero}, ${prox.meta.nome}` : 'Sem meta pendente'}`}
            className={cn(
              'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-semibold tracking-tight transition-transform hover:scale-110 focus-visible:scale-110',
              daVez && 'ring-[3px] ring-tinta ring-offset-2 ring-offset-superficie',
              ativo === i && !daVez && 'ring-2 ring-tinta-suave ring-offset-2 ring-offset-superficie',
              !prox && 'opacity-45',
            )}
            style={{
              left: `${50 + RAIO * Math.cos(a)}%`,
              top: `${50 + RAIO * Math.sin(a)}%`,
              width: `${tamanho}%`,
              height: `${tamanho}%`,
              background: d.cor,
              color: corSobre(d.cor),
              fontSize: `${tamanho * 0.27}cqw`,
            }}
          >
            {siglaDe(d)}
          </button>
        )
      })}

      {/* meio da roda: a meta da vez, ou a próxima meta da disciplina apontada */}
      <div className="absolute top-1/2 left-1/2 flex w-[58%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" aria-live="polite">
        <p className="text-xs text-tinta-suave">
          {ativo === null ? 'Meta da vez' : posicaoMostrada === dados.posicao ? 'Agora' : `Próxima de ${disciplinaMostrada?.nome ?? ''}`}
        </p>
        {metaMostrada && disciplinaMostrada ? (
          <>
            <p className="mt-1 text-lg font-semibold text-tinta numeros">
              {siglaDe(disciplinaMostrada)} · Meta {metaMostrada.numero}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm text-tinta-suave">{metaMostrada.meta.nome}</p>
            <button type="button" onClick={() => aoAbrir(metaMostrada.meta.id)} className="mt-2 text-sm font-medium text-primaria-forte hover:underline dark:text-primaria">
              Ver assuntos
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-tinta-suave">{disciplinaMostrada ? 'Sem meta pendente nesta disciplina.' : 'Ciclo sem metas pendentes.'}</p>
        )}
      </div>
    </div>
  )
}
