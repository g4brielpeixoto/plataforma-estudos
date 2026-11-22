import { Scissors } from 'lucide-react'
import { useMemo } from 'react'
import { Painel } from '@/components/ui'
import type { CicloDados } from '@/hooks/useCicloDados'
import { assuntosDaDisciplina, metaEfetiva, metasPorDisciplina, siglaDe } from '@/lib/ciclos'
import { topicosDaDisciplina } from '@/lib/topicos'
import { cn, corSobre } from '@/lib/utils'
import type { Disciplina } from '@/types'

/**
  Quadro de metas: uma linha por disciplina e um quadradinho por meta. Cumprida fica pintada na cor
  da disciplina; a da vez tem contorno; a que já tem assunto concluído fica com um tom de fundo.
*/
export function QuadroMetas({ dados, aoAbrir, aoDividir }: { dados: CicloDados; aoAbrir: (metaId: string) => void; aoDividir: (d: Disciplina) => void }) {
  const porDisciplina = useMemo(() => metasPorDisciplina(dados.metas), [dados.metas])
  // assuntos ainda sem meta (ex.: adicionados depois de dividir)
  const semMeta = useMemo(() => {
    const m = new Map<string, number>()
    const efetiva = metaEfetiva(dados.topicos)
    for (const d of dados.disciplinas) {
      const n = assuntosDaDisciplina(topicosDaDisciplina(dados.topicos, d.id)).filter((t) => !efetiva.get(t)).length
      if (n) m.set(d.id, n)
    }
    return m
  }, [dados.topicos, dados.disciplinas])

  // ordem: as do ciclo (na ordem em que aparecem), depois as que têm metas fora do ciclo, depois as sem metas
  const linhas = useMemo(() => {
    const vistas = new Set<string>()
    const r: { d: Disciplina; noCiclo: boolean }[] = []
    for (const id of dados.sequencia) {
      const d = dados.disciplinaPorId.get(id)
      if (d && !vistas.has(id)) {
        vistas.add(id)
        r.push({ d, noCiclo: true })
      }
    }
    for (const d of dados.disciplinas) {
      if (vistas.has(d.id) || !porDisciplina.has(d.id)) continue
      vistas.add(d.id)
      r.push({ d, noCiclo: false })
    }
    return { comMetas: r, semMetas: dados.disciplinas.filter((d) => !vistas.has(d.id)) }
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

      {linhas.comMetas.length === 0 && (
        <p className="mt-4 text-[15px] text-tinta-suave">Nenhuma disciplina dividida em metas ainda. Comece pela disciplina que você vai estudar primeiro.</p>
      )}

      <ul className="mt-5 space-y-4">
        {linhas.comMetas.map(({ d, noCiclo }) => {
          const metas = porDisciplina.get(d.id) ?? []
          const cumpridas = metas.filter((m) => dados.situacao.get(m.id)?.cumprida).length
          const faltando = semMeta.get(d.id) ?? 0
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
                <button
                  type="button"
                  onClick={() => aoDividir(d)}
                  aria-label={`Dividir ${d.nome} em metas`}
                  title="Dividir em metas"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
                >
                  <Scissors className="size-4" aria-hidden />
                </button>
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
                {faltando > 0 && (
                  <button type="button" onClick={() => aoDividir(d)} className="ml-1 text-xs text-medio hover:underline">
                    {faltando} {faltando === 1 ? 'assunto sem meta' : 'assuntos sem meta'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {linhas.semMetas.length > 0 && (
        <div className="mt-6 border-t border-linha/70 pt-4">
          <p className="text-sm text-tinta-suave">Ainda não divididas em metas:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {linhas.semMetas.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => aoDividir(d)}
                className="inline-flex items-center gap-2 rounded-lg border border-linha px-2.5 py-1.5 text-sm text-tinta hover:bg-nevoa/50"
              >
                <span className="size-2 rounded-full" style={{ background: d.cor }} aria-hidden />
                {d.nome}
                <Scissors className="size-3.5 text-tinta-suave" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}
    </Painel>
  )
}
