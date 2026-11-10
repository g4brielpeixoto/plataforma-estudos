import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Settings } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useMetas, useSalvarMetas } from '@/hooks/dados'
import { semanaAtual } from '@/lib/constancia'
import { formatarHorasMinutos, mensagemErro, porcentagem } from '@/lib/utils'
import type { Estudo } from '@/types'
import { Botao, Campo, Dialogo, Entrada, Painel } from './ui'

/** Metas semanais de horas e questões (segunda a domingo), no formato do card de referência */
export function MetasSemanais({ estudos, className }: { estudos: Estudo[]; className?: string }) {
  const metas = useMetas()
  const [configurando, setConfigurando] = useState(false)

  const semana = semanaAtual()
  const feito = useMemo(() => {
    const de = semana.de.getTime()
    const ate = semana.ate.getTime()
    let segundos = 0
    let questoes = 0
    for (const e of estudos) {
      const t = new Date(e.data_hora).getTime()
      if (t < de || t > ate) continue
      segundos += e.duracao_segundos ?? 0
      questoes += e.questoes_feitas ?? 0
    }
    return { segundos, questoes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudos, semana.de.getTime()])

  const metaMin = metas.data?.minutos_semana ?? null
  const metaQ = metas.data?.questoes_semana ?? null
  const semMetas = !metas.isLoading && !metaMin && !metaQ

  return (
    <Painel className={className}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Metas semanais</h2>
          <button onClick={() => setConfigurando(true)} aria-label="Definir metas semanais" className="-m-2 rounded-lg p-2 text-tinta-suave/80 hover:bg-superficie-2 hover:text-tinta">
            <Settings className="size-5" aria-hidden />
          </button>
        </div>

        {semMetas ? (
          <div className="mt-4">
            <p className="text-[15px] text-tinta-suave">Defina quantas horas e quantas questões você quer fazer por semana para acompanhar aqui.</p>
            <Botao variante="secundario" className="mt-4" onClick={() => setConfigurando(true)}>
              Definir metas
            </Botao>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <LinhaMeta
              titulo="Horas de estudo"
              atual={formatarHorasMinutos(feito.segundos)}
              alvo={metaMin ? `${formatarHorasMinutos(metaMin * 60)} planejadas` : null}
              pct={metaMin ? porcentagem(feito.segundos, metaMin * 60) : null}
              corTexto="text-primaria-forte dark:text-primaria"
              corBarra="var(--c-primaria)"
            />
            <LinhaMeta
              titulo="Questões resolvidas"
              atual={String(feito.questoes)}
              alvo={metaQ ? `${metaQ} esperadas` : null}
              pct={metaQ ? porcentagem(feito.questoes, metaQ) : null}
              corTexto="text-meta-questoes-texto"
              corBarra="var(--c-meta-questoes)"
            />
            <p className="text-[15px] text-tinta-suave">
              Meta definida por você · semana de {format(semana.de, "d 'de' MMM", { locale: ptBR })} a {format(semana.ate, "d 'de' MMM", { locale: ptBR })}
            </p>
          </div>
        )}
      </div>

      <ConfigurarMetas aberto={configurando} aoMudar={setConfigurando} minutos={metaMin} questoes={metaQ} />
    </Painel>
  )
}

function LinhaMeta({ titulo, atual, alvo, pct, corTexto, corBarra }: { titulo: string; atual: string; alvo: string | null; pct: number | null; corTexto: string; corBarra: string }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">{titulo}</p>
          <p className="mt-1 text-[17px] text-tinta-suave numeros">
            <span className={`font-semibold ${corTexto}`}>{atual}</span>
            {alvo ? <> / {alvo}</> : <span className="text-sm"> · sem meta definida</span>}
          </p>
        </div>
        {pct !== null && (
          <div className="shrink-0 text-right leading-tight">
            <p className={`text-xl font-semibold numeros ${corTexto}`}>{pct}%</p>
            <p className="text-[15px] text-tinta-suave">da meta</p>
          </div>
        )}
      </div>
      {pct !== null && (
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-label={titulo} aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: corBarra }} />
        </div>
      )}
    </div>
  )
}

function ConfigurarMetas({ aberto, aoMudar, minutos, questoes }: { aberto: boolean; aoMudar: (a: boolean) => void; minutos: number | null; questoes: number | null }) {
  const { sessao } = useAuth()
  const salvar = useSalvarMetas()
  const [horas, setHoras] = useState('')
  const [qtd, setQtd] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setHoras(minutos ? String(Math.round((minutos / 60) * 10) / 10) : '')
    setQtd(questoes ? String(questoes) : '')
  }, [aberto, minutos, questoes])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const h = horas.trim() ? Number(horas.replace(',', '.')) : null
    const q = qtd.trim() ? Math.round(Number(qtd)) : null
    if (h !== null && (!Number.isFinite(h) || h <= 0 || h > 168)) return setErro('As horas por semana precisam estar entre 0,5 e 168.')
    if (q !== null && (!Number.isFinite(q) || q <= 0)) return setErro('O número de questões precisa ser maior que zero.')
    if (!sessao) return
    try {
      await salvar.mutateAsync({ userId: sessao.user.id, minutos: h ? Math.round(h * 60) : null, questoes: q })
      toast.success('Metas salvas.')
      aoMudar(false)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo="Metas semanais" descricao="Quanto você quer estudar por semana, de segunda a domingo. Deixe em branco para não usar uma das metas." largura="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Horas por semana" htmlFor="m-horas">
            <Entrada id="m-horas" inputMode="decimal" placeholder="Ex.: 20" value={horas} onChange={(e) => setHoras(e.target.value)} className="numeros" />
          </Campo>
          <Campo rotulo="Questões por semana" htmlFor="m-questoes">
            <Entrada id="m-questoes" inputMode="numeric" placeholder="Ex.: 200" value={qtd} onChange={(e) => setQtd(e.target.value)} className="numeros" />
          </Campo>
        </div>
        {erro && (
          <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar metas
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
