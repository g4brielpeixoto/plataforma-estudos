import { ChevronRight, Plus, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { usePlanner } from '@/hooks/dados'
import { usePlannerAcoes } from '@/hooks/usePlannerAcoes'
import { hojeChave, itensAtrasados, ordenarItens, resumoItens, rotuloMinutos } from '@/lib/planner'
import type { Disciplina, Topico } from '@/types'
import { CartaoPlanner } from './CartaoPlanner'
import { BarraProgresso, Painel } from './ui'

/** Card do Início com o que está no planner para hoje (e o aviso de atrasados) */
export function PlanejamentoHoje({ disciplinas, topicos }: { disciplinas: Disciplina[]; topicos: Topico[] }) {
  const planner = usePlanner()
  const acoes = usePlannerAcoes()
  const hoje = hojeChave()
  const itens = useMemo(() => planner.data ?? [], [planner.data])
  const deHoje = useMemo(() => itens.filter((i) => i.data === hoje).sort(ordenarItens), [itens, hoje])
  const atrasados = useMemo(() => itensAtrasados(itens, hoje).length, [itens, hoje])
  const mapaDisciplinas = useMemo(() => new Map(disciplinas.map((d) => [d.id, d])), [disciplinas])
  const mapaTopicos = useMemo(() => new Map(topicos.map((t) => [t.id, t])), [topicos])
  const r = resumoItens(deHoje)

  if (planner.isLoading) return null

  return (
    <Painel className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Planejamento de hoje</h2>
        <Link to="/planner" className="inline-flex items-center gap-0.5 text-sm font-medium text-primaria-forte hover:underline dark:text-primaria">
          Planner <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {atrasados > 0 && (
        <Link to="/planner" className="mt-3 flex items-center gap-2 rounded-xl bg-ruim-fundo px-3 py-2 text-sm font-medium text-ruim hover:opacity-90">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {atrasados} {atrasados === 1 ? 'item atrasado' : 'itens atrasados'} para reagendar
        </Link>
      )}

      {deHoje.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-superficie-2/70 px-4 py-3">
          <p className="text-sm text-tinta-suave">Nada planejado para hoje.</p>
          <button type="button" onClick={() => acoes.novo(hoje)} className="inline-flex items-center gap-1 text-sm font-semibold text-primaria-forte hover:underline dark:text-primaria">
            <Plus className="size-4" aria-hidden /> Planejar
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <BarraProgresso valor={(r.feitos / r.total) * 100} cor="var(--c-visto)" rotulo="Itens de hoje concluídos" />
            <span className="shrink-0 text-sm text-tinta-suave numeros">
              {r.feitos} de {r.total}
              {r.minutos ? ` · ${rotuloMinutos(r.minutos)}` : ''}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {deHoje.map((i) => (
              <li key={i.id}>
                <CartaoPlanner
                  item={i}
                  variante="largo"
                  disciplina={mapaDisciplinas.get(i.disciplina_id)}
                  topico={i.topico_id ? mapaTopicos.get(i.topico_id) : undefined}
                  acoes={acoes}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {acoes.dialogos}
    </Painel>
  )
}
