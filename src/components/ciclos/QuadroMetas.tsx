import { useMemo } from 'react'
import { Painel } from '@/components/ui'
import type { CicloDados } from '@/hooks/useCicloDados'
import { metasPorDisciplina, siglaDe } from '@/lib/ciclos'
import { cn, corSobre } from '@/lib/utils'
import type { Disciplina } from '@/types'

/**
  Quadro de metas: uma linha por disciplina e um quadradinho por meta. Cumprida fica pintada na cor
  da disciplina; a da vez tem contorno; a que já tem assunto concluído fica com um tom de fundo.
*/
export function QuadroMetas({ dados, aoAbrir }: { dados: CicloDados; aoAbrir: (metaId: string) => void }) {
  const porDisciplina = useMemo(() => metasPorDisciplina(dados.metas), [dados.metas])

  // ordem: as do ciclo (na ordem em que aparecem), depois as que estão fora do ciclo
  const linhas = useMemo(() => {
    const vistas = new Set<string>()
    const r: { d: Disciplina; noCiclo: boolean }[] = []
    for (const id of dados.sequencia) {
      const d = dados.disciplinaPorId.get(id)
      if (d && !vistas.has(id) && porDisciplina.has(id)) {
        vistas.add(id)
        r.push({ d, noCiclo: true })
      }
    }
    for (const d of dados.disciplinas) {
      if (vistas.has(d.id) || !porDisciplina.has(d.id)) continue
      vistas.add(d.id)
      r.push({ d, noCiclo: false })
    }
    return r
  }, [dados.sequencia, dados.disciplinaPorId, dados.disciplinas, porDisciplina])
  return (
    <Painel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Quadro de metas</h2>
        <p className="flex items-center gap-3 text-xs text-tinta-suave">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded bg-tinta-suave" aria-hidden /> cumprida
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded border-2 border-tinta" aria-hidden /> da vez
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded border border-tinta-suave/60" aria-hidden /> pendente
          </span>
        </p>
      </div>

      {linhas.length === 0 && (
        <p className="mt-4 text-[15px] text-tinta-suave">Cadastre os tópicos do edital: cada tópico principal vira uma meta.</p>
      )}

      <ul className="mt-5 space-y-4">
        {linhas.map(({ d, noCiclo }) => {
          const metas = porDisciplina.get(d.id) ?? []
          const cumpridas = metas.filter((m) => dados.situacao.get(m.id)?.cumprida).length
          return (
            <li key={d.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:items-start">
                <span className="mt-0.5 size-2.5 shrink-0 rounded-full" style={{ background: d.cor }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="font-semibold text-tinta">{siglaDe(d)}</span>
                    <span className="text-xs text-tinta-suave numeros">
                      {cumpridas}/{metas.length}
                    </span>
                  </p>
                  <p className="truncate text-xs text-tinta-suave" title={d.nome}>
                    {d.nome}
                    {!noCiclo && ' · fora do ciclo'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {metas.map((m) => {
                  const s = dados.situacao.get(m.id)
                  if (!s) return null
                  const daVez = dados.metaDaVez?.meta.id === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => aoAbrir(m.id)}
                      title={`Meta ${s.numero}: ${m.nome} (${s.concluidos} de ${s.topicos.length})`}
                      aria-label={`Meta ${s.numero}: ${m.nome}. ${s.cumprida ? 'Cumprida' : `${s.concluidos} de ${s.topicos.length} assuntos`}${daVez ? '. É a meta da vez' : ''}`}
                      className={cn(
                        'grid size-9 place-items-center rounded-lg text-sm font-semibold transition-transform hover:scale-110 numeros',
                        daVez && 'ring-2 ring-tinta ring-offset-2 ring-offset-superficie',
                      )}
                      style={
                        s.cumprida
                          ? { background: d.cor, color: corSobre(d.cor) }
                          : {
                              border: `1.5px solid color-mix(in srgb, ${d.cor} 60%, transparent)`,
                              background: s.concluidos > 0 ? `color-mix(in srgb, ${d.cor} 14%, transparent)` : undefined,
                              color: 'var(--c-tinta)',
                            }
                      }
                    >
                      {s.numero}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>

    </Painel>
  )
}
