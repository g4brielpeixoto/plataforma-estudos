import { ArrowRight, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { LinhaRevisao, useAcoesRevisao } from '@/components/Revisoes'
import { Painel } from '@/components/ui'
import { useRevisoes } from '@/hooks/dados'
import { diaMes, quandoRevisao, separarRevisoes } from '@/lib/revisoes'

const MAXIMO = 6

/** Cartão do Início: revisões atrasadas e de hoje (some quando não há nenhuma pendente) */
export function RevisoesHoje({ className }: { className?: string }) {
  const revisoes = useRevisoes()
  const acoes = useAcoesRevisao()
  const sep = useMemo(() => separarRevisoes(revisoes.data ?? []), [revisoes.data])
  const lista = [...sep.atrasadas, ...sep.hoje]
  const proxima = sep.proximas[0]
  if (revisoes.isLoading || (!lista.length && !proxima)) return null

  return (
    <Painel className={className ? `p-5 sm:p-6 ${className}` : 'p-5 sm:p-6'}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          <RotateCcw className="size-4 text-revisao" aria-hidden /> Revisões de hoje
          {lista.length > 0 && <span className="font-normal numeros">· {lista.length}</span>}
        </h2>
        <Link to="/revisoes" className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-tinta-suave hover:bg-superficie-2 hover:text-tinta">
          Ver todas <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {lista.length ? (
        <>
          <ul className="mt-1 divide-y divide-linha/60">
            {lista.slice(0, MAXIMO).map((r) => (
              <LinhaRevisao key={r.id} revisao={r} acoes={acoes} />
            ))}
          </ul>
          {lista.length > MAXIMO && (
            <Link to="/revisoes" className="mt-1 inline-block text-sm text-tinta-suave hover:text-tinta">
              e mais {lista.length - MAXIMO}…
            </Link>
          )}
        </>
      ) : (
        <p className="mt-3 text-[15px] text-tinta-suave">Nenhuma revisão para hoje. A próxima é {proxima ? `${quandoRevisao(proxima.data)} (${diaMes(proxima.data)})` : ''}.</p>
      )}
      {acoes.dialogos}
    </Painel>
  )
}
