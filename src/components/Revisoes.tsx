import { addDays } from 'date-fns'
import { CalendarClock, Play, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EstudoDialog } from '@/components/EstudoDialog'
import { Botao, Campo, Dialogo, Entrada } from '@/components/ui'
import { useAtualizarRevisao, useDisciplinas, useExcluirRevisao, useTopicos } from '@/hooks/dados'
import { siglaDe } from '@/lib/ciclos'
import { chaveData, diaMes, hojeChave, paraData, quandoRevisao } from '@/lib/revisoes'
import { numeracaoDeTodos } from '@/lib/topicos'
import { cn, mensagemErro } from '@/lib/utils'
import type { Revisao } from '@/types'

/**
  Ações das revisões compartilhadas entre o cartão do Início e a tela Revisões:
  marcar como feita, revisar (abre o Salvar estudo na categoria Revisão; ao salvar, a revisão fica feita),
  remarcar e excluir.
*/
export function useAcoesRevisao() {
  const [revisando, setRevisando] = useState<Revisao | null>(null)
  const [remarcando, setRemarcando] = useState<Revisao | null>(null)
  const atualizar = useAtualizarRevisao()

  const alternarFeita = (r: Revisao) =>
    atualizar.mutate(
      { id: r.id, concluido_em: r.concluido_em ? null : new Date().toISOString() },
      { onError: (e) => toast.error(`Não deu para marcar a revisão. ${mensagemErro(e)}`) },
    )

  const dialogos = (
    <>
      <EstudoDialog
        aberto={!!revisando}
        aoMudar={(a) => !a && setRevisando(null)}
        iniciais={revisando ? { disciplinaId: revisando.disciplina_id, topicoId: revisando.topico_id ?? undefined, categoria: 'Revisão', revisaoId: revisando.id } : undefined}
      />
      <RemarcarDialog revisao={remarcando} aoFechar={() => setRemarcando(null)} />
    </>
  )
  return { alternarFeita, revisar: setRevisando, remarcar: setRemarcando, dialogos }
}

/** Uma revisão numa linha: check, disciplina, tópico, de qual estudo veio e quando; Revisar e remarcar */
export function LinhaRevisao({ revisao: r, acoes, mostrarDia }: { revisao: Revisao; acoes: ReturnType<typeof useAcoesRevisao>; mostrarDia?: boolean }) {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const d = (disciplinas.data ?? []).find((x) => x.id === r.disciplina_id)
  const t = (topicos.data ?? []).find((x) => x.id === r.topico_id)
  const numeros = useMemo(() => numeracaoDeTodos(topicos.data ?? []), [topicos.data])
  const feita = !!r.concluido_em
  const atrasada = !feita && r.data < hojeChave()
  const nome = t ? t.nome : 'Tópico apagado'

  return (
    <li className={cn('flex items-start gap-3 py-3', feita && 'opacity-70')}>
      <input
        type="checkbox"
        className="visto mt-0.5"
        checked={feita}
        onChange={() => acoes.alternarFeita(r)}
        aria-label={feita ? `Desmarcar a revisão de ${nome}` : `Marcar a revisão de ${nome} como feita`}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs text-tinta-suave">
          <span className="size-2 shrink-0 rounded-full" style={{ background: d?.cor ?? 'var(--c-tinta-suave)' }} aria-hidden />
          <span className="truncate" title={d?.nome}>
            {d ? siglaDe(d) : 'Disciplina apagada'}
          </span>
          {(mostrarDia || atrasada) && (
            <>
              <span aria-hidden>·</span>
              <span className={cn('whitespace-nowrap numeros', atrasada && 'font-medium text-ruim')}>
                {mostrarDia ? `${diaMes(r.data)}, ` : ''}
                {quandoRevisao(r.data)}
              </span>
            </>
          )}
        </p>
        <p className="mt-0.5 leading-snug text-tinta">
          {t && numeros.get(t.id) && <span className="mr-1.5 text-tinta-suave numeros">{numeros.get(t.id)}</span>}
          {nome}
        </p>
        {r.observacao && <p className="mt-0.5 text-xs text-tinta-suave numeros">{r.observacao}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!feita && (
          <Botao tamanho="sm" variante="secundario" onClick={() => acoes.revisar(r)} title="Registrar a revisão (ao salvar, ela fica feita)">
            <Play className="size-3.5" aria-hidden /> Revisar
          </Botao>
        )}
        <button
          type="button"
          onClick={() => acoes.remarcar(r)}
          aria-label={`Remarcar ou excluir a revisão de ${nome}`}
          title="Remarcar ou excluir"
          className="grid size-8 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
        >
          <CalendarClock className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}

/** Muda o dia da revisão (atalhos amanhã / +3 / +7 dias) ou exclui */
function RemarcarDialog({ revisao, aoFechar }: { revisao: Revisao | null; aoFechar: () => void }) {
  const atualizar = useAtualizarRevisao()
  const excluir = useExcluirRevisao()
  const [dia, setDia] = useState('')
  useEffect(() => {
    if (revisao) setDia(revisao.data)
  }, [revisao])
  const hoje = new Date()
  const atalhos = [
    { rotulo: 'Hoje', dia: chaveData(hoje) },
    { rotulo: 'Amanhã', dia: chaveData(addDays(hoje, 1)) },
    { rotulo: '+3 dias', dia: revisao ? chaveData(addDays(paraData(revisao.data < chaveData(hoje) ? chaveData(hoje) : revisao.data), 3)) : '' },
    { rotulo: '+7 dias', dia: revisao ? chaveData(addDays(paraData(revisao.data < chaveData(hoje) ? chaveData(hoje) : revisao.data), 7)) : '' },
  ]

  const salvar = async () => {
    if (!revisao || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return
    try {
      await atualizar.mutateAsync({ id: revisao.id, data: dia })
      toast.success(`Revisão remarcada para ${diaMes(dia)}.`)
      aoFechar()
    } catch (e) {
      toast.error(`Não deu para remarcar. ${mensagemErro(e)}`)
    }
  }

  return (
    <Dialogo aberto={!!revisao} aoMudar={(a) => !a && aoFechar()} titulo="Remarcar revisão" descricao={revisao?.observacao ?? undefined} largura="max-w-sm">
      <div className="space-y-4">
        <Campo rotulo="Dia da revisão" htmlFor="rv-dia">
          <Entrada id="rv-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="numeros" />
        </Campo>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos">
          {atalhos.map((a) => (
            <button
              key={a.rotulo}
              type="button"
              onClick={() => setDia(a.dia)}
              className={cn('h-9 rounded-full border px-3.5 text-sm font-medium transition-colors', dia === a.dia ? 'border-primaria bg-nevoa text-tinta' : 'border-linha text-tinta hover:border-lilas')}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-linha/70 pt-4">
          <Botao
            type="button"
            variante="fantasma"
            className="mr-auto px-2 text-ruim"
            carregando={excluir.isPending}
            onClick={async () => {
              if (!revisao) return
              try {
                await excluir.mutateAsync(revisao.id)
                toast.success('Revisão excluída.')
                aoFechar()
              } catch (e) {
                toast.error(`Não deu para excluir. ${mensagemErro(e)}`)
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </Botao>
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="button" onClick={salvar} carregando={atualizar.isPending} disabled={!dia}>
            Remarcar
          </Botao>
        </div>
      </div>
    </Dialogo>
  )
}
