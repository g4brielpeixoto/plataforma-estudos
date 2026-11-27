import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { LinhaRevisao, useAcoesRevisao } from '@/components/Revisoes'
import { CabecalhoPagina, Carregando, Painel } from '@/components/ui'
import { useRevisoes } from '@/hooks/dados'
import { paraData, quandoRevisao, separarRevisoes } from '@/lib/revisoes'
import { cn, mensagemErro } from '@/lib/utils'
import type { Revisao } from '@/types'

/**
  Revisões programadas ao salvar um estudo: atrasadas, de hoje, próximas (agrupadas por dia)
  e as feitas nos últimos 7 dias.
*/
export function Revisoes() {
  const revisoes = useRevisoes()
  const acoes = useAcoesRevisao()
  const [verFeitas, setVerFeitas] = useState(false)
  const sep = useMemo(() => separarRevisoes(revisoes.data ?? []), [revisoes.data])
  const proximasPorDia = useMemo(() => {
    const m = new Map<string, Revisao[]>()
    for (const r of sep.proximas) m.set(r.data, [...(m.get(r.data) ?? []), r])
    return [...m]
  }, [sep.proximas])

  if (revisoes.isLoading) return <Carregando texto="Carregando as revisões…" />
  if (revisoes.error) return <p className="rounded-xl bg-ruim-fundo p-4 text-ruim">Não deu para carregar as revisões. {mensagemErro(revisoes.error)} Recarregue a página.</p>

  const nada = !sep.atrasadas.length && !sep.hoje.length && !sep.proximas.length

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Revisões" subtitulo="Programe ao salvar um estudo e marque aqui quando revisar." />

      {nada && (
        <Painel className="p-6 text-center">
          <p className="text-lg text-tinta">Nenhuma revisão pendente.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-tinta-suave">
            Ao salvar um estudo, ligue "Programar revisões" e escolha os intervalos (1, 7, 21 dias…). Elas aparecem aqui e no Início no dia certo.
          </p>
        </Painel>
      )}

      <div className="space-y-5">
        {sep.atrasadas.length > 0 && (
          <Grupo titulo="Atrasadas" qtd={sep.atrasadas.length} destaque>
            {sep.atrasadas.map((r) => (
              <LinhaRevisao key={r.id} revisao={r} acoes={acoes} />
            ))}
          </Grupo>
        )}
        {(sep.hoje.length > 0 || !nada) && (
          <Grupo titulo="Hoje" qtd={sep.hoje.length}>
            {sep.hoje.length ? sep.hoje.map((r) => <LinhaRevisao key={r.id} revisao={r} acoes={acoes} />) : <li className="py-3 text-sm text-tinta-suave">Nada para hoje.</li>}
          </Grupo>
        )}
        {proximasPorDia.length > 0 && (
          <Painel className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">
              Próximas <span className="font-normal numeros">· {sep.proximas.length}</span>
            </h2>
            <div className="mt-2 space-y-4">
              {proximasPorDia.map(([dia, lista]) => (
                <section key={dia}>
                  <h3 className="border-b border-linha/70 pb-1.5 text-sm font-medium text-tinta">
                    <span>{maiuscula(format(paraData(dia), "EEEE, d 'de' MMMM", { locale: ptBR }))}</span>
                    <span className="ml-2 font-normal text-tinta-suave">{quandoRevisao(dia)}</span>
                  </h3>
                  <ul className="divide-y divide-linha/60">
                    {lista.map((r) => (
                      <LinhaRevisao key={r.id} revisao={r} acoes={acoes} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Painel>
        )}
        {sep.feitas.length > 0 && (
          <div>
            <button type="button" onClick={() => setVerFeitas((v) => !v)} className="text-sm font-medium text-tinta-suave hover:text-tinta" aria-expanded={verFeitas}>
              {verFeitas ? 'Esconder' : 'Ver'} as feitas nos últimos 7 dias ({sep.feitas.length})
            </button>
            {verFeitas && (
              <Grupo titulo="Feitas" qtd={sep.feitas.length} className="mt-3">
                {sep.feitas.map((r) => (
                  <LinhaRevisao key={r.id} revisao={r} acoes={acoes} mostrarDia />
                ))}
              </Grupo>
            )}
          </div>
        )}
      </div>
      {acoes.dialogos}
    </div>
  )
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function Grupo({ titulo, qtd, destaque, className, children }: { titulo: string; qtd: number; destaque?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Painel className={cn('p-5 sm:p-6', destaque && 'border-ruim/40', className)}>
      <h2 className={cn('text-sm font-semibold tracking-[0.08em] uppercase', destaque ? 'text-ruim' : 'text-tinta-suave')}>
        {titulo} <span className="font-normal numeros">· {qtd}</span>
      </h2>
      <ul className="mt-1 divide-y divide-linha/60">{children}</ul>
    </Painel>
  )
}
