import { RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useDisciplinas, useEstudos, usePlanner, useSalvarItemPlanner, useTopicos } from '@/hooks/dados'
import { amanhaChave, hojeChave, proximaOrdem, proximaSemanaChave } from '@/lib/planner'
import { paraRevisar, textoAtraso, type RevisaoVencida } from '@/lib/revisoes'
import { numeracaoDeTodos } from '@/lib/topicos'
import { cn, mensagemErro } from '@/lib/utils'
import { SeloAcerto } from './ui'

const VISIVEIS = 4

/**
  Fila "Para revisar" (Início e Planner): tópicos e subtópicos cuja revisão venceu pelo acerto nas questões,
  do pior para o melhor. Cada um vira um item de revisão no planner no dia escolhido; nada entra sozinho.
  Não aparece quando a fila está vazia.
*/
export function ParaRevisar({ className }: { className?: string }) {
  const estudos = useEstudos()
  const planner = usePlanner()
  const topicos = useTopicos()
  const disciplinas = useDisciplinas()
  const salvar = useSalvarItemPlanner()
  const [todos, setTodos] = useState(false)
  const [gravando, setGravando] = useState<string | null>(null)

  const hoje = hojeChave()
  const mapaTopicos = useMemo(() => new Map((topicos.data ?? []).map((t) => [t.id, t])), [topicos.data])
  const mapaDisciplinas = useMemo(() => new Map((disciplinas.data ?? []).map((d) => [d.id, d])), [disciplinas.data])
  const numeros = useMemo(() => numeracaoDeTodos(topicos.data ?? []), [topicos.data])
  const fila = useMemo(
    () => paraRevisar(estudos.data ?? [], planner.data ?? [], hoje, new Set(mapaTopicos.keys())),
    [estudos.data, planner.data, hoje, mapaTopicos],
  )

  if (!estudos.data || !planner.data || !topicos.data || fila.length === 0) return null

  const agendar = async (r: RevisaoVencida, data: string, quando: string) => {
    const topico = mapaTopicos.get(r.topicoId)
    if (!topico || gravando) return
    setGravando(r.topicoId)
    try {
      await salvar.mutateAsync({
        dados: { data, disciplina_id: topico.disciplina_id, topico_id: topico.id, tipo: 'revisao', minutos_previstos: null, observacao: null, ordem: proximaOrdem(planner.data ?? [], data) },
      })
      toast.success(`Revisão de ${topico.nome} no planner ${quando}.`)
    } catch (err) {
      toast.error(mensagemErro(err))
    } finally {
      setGravando(null)
    }
  }

  const n = fila.length
  const visiveis = todos ? fila : fila.slice(0, VISIVEIS)
  const amanha = amanhaChave()
  const proxima = proximaSemanaChave()

  return (
    <section aria-labelledby="titulo-para-revisar" className={cn('rounded-2xl border border-revisao/25 bg-revisao-fundo/55 p-4 sm:p-5', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <RotateCcw className="mt-0.5 size-5 shrink-0 text-revisao" aria-hidden />
        <div className="min-w-0">
          <h2 id="titulo-para-revisar" className="font-semibold text-tinta">
            {n} {n === 1 ? 'tópico para revisar' : 'tópicos para revisar'}
          </h2>
          <p className="text-sm text-tinta-suave">Pelo seu acerto nas questões, do menor para o maior. Escolha o dia e a revisão entra no planner.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-revisao/15">
        {visiveis.map((r) => {
          const topico = mapaTopicos.get(r.topicoId)
          if (!topico) return null
          const disciplina = mapaDisciplinas.get(topico.disciplina_id)
          const numero = numeros.get(topico.id)
          const ocupado = gravando === r.topicoId
          return (
            <li key={r.topicoId} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5', ocupado && 'opacity-60')}>
              <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
                <SeloAcerto pct={r.pct} className="w-12 shrink-0 justify-center" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-tinta">
                    {numero && <span className="mr-1.5 text-tinta-suave numeros">{numero}</span>}
                    {topico.nome}
                  </p>
                  <p className="text-xs text-tinta-suave numeros">
                    {disciplina?.nome ?? 'Disciplina excluída'} · {r.acertadas} de {r.feitas} questões · {textoAtraso(r.atraso)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="sr-only">Planejar a revisão de {topico.nome} para:</span>
                <BotaoDia disabled={!!gravando} onClick={() => void agendar(r, hoje, 'hoje')}>
                  Hoje
                </BotaoDia>
                <BotaoDia disabled={!!gravando} onClick={() => void agendar(r, amanha, 'amanhã')}>
                  Amanhã
                </BotaoDia>
                <BotaoDia disabled={!!gravando} onClick={() => void agendar(r, proxima, 'na próxima segunda')}>
                  Próx. semana
                </BotaoDia>
              </div>
            </li>
          )
        })}
      </ul>
      {n > VISIVEIS && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-1 text-sm font-medium text-revisao hover:underline">
          {todos ? 'Ver menos' : `Ver todos (${n})`}
        </button>
      )}
    </section>
  )
}

function BotaoDia({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="h-9 rounded-lg border border-linha bg-superficie px-2.5 text-sm font-medium text-tinta transition-colors hover:border-lilas disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {children}
    </button>
  )
}
