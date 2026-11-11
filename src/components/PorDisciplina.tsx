import { useMemo } from 'react'
import { Link } from 'react-router'
import { calcularIndicadores } from '@/lib/indicadores'
import { formatarDuracao } from '@/lib/utils'
import type { Disciplina, Estudo, Topico } from '@/types'
import { BarraProgresso, Painel, SeloAcerto } from './ui'

const tituloCard = 'text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase'

/** Tempo, questões, acerto e progresso no edital de cada disciplina */
export function PorDisciplina({ disciplinas, topicos, estudos }: { disciplinas: Disciplina[]; topicos: Topico[]; estudos: Estudo[] }) {
  const linhas = useMemo(() => {
    const topicoParaDisciplina = new Map(topicos.map((t) => [t.id, t.disciplina_id]))
    return disciplinas.map((d) => {
      const meus = topicos.filter((t) => t.disciplina_id === d.id)
      const est = estudos.filter((e) => topicoParaDisciplina.get(e.topico_id) === d.id)
      return { disciplina: d, ...calcularIndicadores(est, meus) }
    })
  }, [disciplinas, topicos, estudos])

  return (
    <Painel className="p-5 sm:p-6">
      <h2 className={tituloCard}>Por disciplina</h2>
      {linhas.length === 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">Cadastre as disciplinas no edital para ver os números de cada uma.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {linhas.map((x) => (
            <li key={x.disciplina.id}>
              <Link to={`/edital/${x.disciplina.id}`} className="group block">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-tinta group-hover:text-primaria-forte dark:group-hover:text-primaria">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.disciplina.cor }} aria-hidden />
                    <span className="truncate">{x.disciplina.nome}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-tinta-suave numeros">
                    {x.tempoSegundos > 0 && formatarDuracao(x.tempoSegundos)}
                    {x.questoesFeitas > 0 && <span className="hidden sm:inline">· {x.questoesFeitas} questões</span>}
                    <SeloAcerto pct={x.acertoPct} className="text-xs" />
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <BarraProgresso valor={x.progressoPct} cor={x.disciplina.cor} rotulo={`Progresso em ${x.disciplina.nome}`} />
                  <span className="w-20 shrink-0 text-right text-xs text-tinta-suave numeros">
                    {x.topicosConcluidos}/{x.topicosTotal} tópicos
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  )
}
