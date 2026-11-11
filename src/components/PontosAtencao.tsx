import { differenceInCalendarDays } from 'date-fns'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { resumirPorTopico } from '@/lib/indicadores'
import type { Disciplina, Estudo, Topico } from '@/types'
import { Painel, SeloAcerto } from './ui'

const tituloCard = 'text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase'
const QUANTOS = 8
/** Só entra em "há mais tempo sem estudar" quem está parado há pelo menos isso */
const DIAS_PARADO = 3

/** Tópicos com menor acerto (com pelo menos 5 questões) e os que estão há mais tempo sem estudo */
export function PontosAtencao({ disciplinas, topicos, estudos }: { disciplinas: Disciplina[]; topicos: Topico[]; estudos: Estudo[] }) {
  const atencao = useMemo(() => {
    const resumo = resumirPorTopico(estudos)
    const porId = new Map(disciplinas.map((d) => [d.id, d]))
    const lista = topicos.map((t) => ({ topico: t, disciplina: porId.get(t.disciplina_id), resumo: resumo.get(t.id) }))
    const piores = lista
      .filter((x) => x.resumo && x.resumo.questoesFeitas >= 5 && x.resumo.acertoPct !== null && x.resumo.acertoPct < 80)
      .sort((a, b) => (a.resumo!.acertoPct ?? 0) - (b.resumo!.acertoPct ?? 0))
      .slice(0, QUANTOS)
    const hoje = new Date()
    const parados = lista
      .filter((x) => !x.topico.concluido && x.resumo?.ultimoEstudo && differenceInCalendarDays(hoje, new Date(x.resumo.ultimoEstudo)) >= DIAS_PARADO)
      .sort((a, b) => a.resumo!.ultimoEstudo!.localeCompare(b.resumo!.ultimoEstudo!))
      .slice(0, QUANTOS)
    return { piores, parados }
  }, [estudos, topicos, disciplinas])

  const item = (x: (typeof atencao.piores)[number], direita: ReactNode) => (
    <li key={x.topico.id}>
      <Link to={`/edital/${x.topico.disciplina_id}`} className="group flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0">
          <span className="block truncate text-tinta group-hover:text-primaria-forte dark:group-hover:text-primaria">{x.topico.nome}</span>
          <span className="block truncate text-xs text-tinta-suave">{x.disciplina?.nome}</span>
        </span>
        {direita}
      </Link>
    </li>
  )

  return (
    <Painel className="p-5 sm:p-6">
      <h2 className={tituloCard}>Pontos de atenção</h2>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-tinta">Menor acerto</h3>
          {atencao.piores.length === 0 ? (
            <p className="mt-1 text-sm text-tinta-suave">Nenhum tópico abaixo de 80% (com pelo menos 5 questões).</p>
          ) : (
            <ul className="mt-2 space-y-2">{atencao.piores.map((x) => item(x, <SeloAcerto pct={x.resumo!.acertoPct} />))}</ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-tinta">Há mais tempo sem estudar</h3>
          {atencao.parados.length === 0 ? (
            <p className="mt-1 text-sm text-tinta-suave">Nenhum tópico em andamento parado há {DIAS_PARADO} dias ou mais.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {atencao.parados.map((x) =>
                item(
                  x,
                  <span className="shrink-0 text-xs text-tinta-suave numeros">
                    {differenceInCalendarDays(new Date(), new Date(x.resumo!.ultimoEstudo!))} dias
                  </span>,
                ),
              )}
            </ul>
          )}
        </div>
      </div>
    </Painel>
  )
}
