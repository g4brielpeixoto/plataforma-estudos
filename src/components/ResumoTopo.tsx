import { ArrowDown, ArrowUp, ClipboardCheck, Clock, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { dentro, estudosEm, mesAnteriorMesmoTrecho, mesAtual, somarEstudos, variacaoPct } from '@/lib/periodos'
import { cn, formatarHorasMinutos, nivelAcerto, porcentagem, textoNivel } from '@/lib/utils'
import type { Estudo, Topico } from '@/types'
import { VersiculoMini } from './VersiculoCard'

interface Variacao {
  texto: string
  subiu: boolean
  dica: string
}

function Selo({ v }: { v: Variacao | null }) {
  if (!v) return null
  return (
    <span
      title={v.dica}
      className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold numeros', v.subiu ? 'bg-bom-fundo text-bom' : 'bg-ruim-fundo text-ruim')}
    >
      {v.subiu ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {v.texto}
      <span className="sr-only"> {v.dica}</span>
    </span>
  )
}

function Cartao({ titulo, icone, valor, complemento, rodape, variacao, className }: { titulo: string; icone: ReactNode; valor: ReactNode; complemento?: ReactNode; rodape: ReactNode; variacao: Variacao | null; className?: string }) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-2xl border border-linha/70 bg-superficie p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-tinta-suave uppercase sm:pt-1.5 sm:text-[13px]">{titulo}</h2>
        <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-nevoa text-primaria-forte sm:grid dark:text-primaria">{icone}</span>
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 numeros">
        <span className="text-[1.55rem] leading-none font-semibold tracking-tight text-tinta sm:text-[1.9rem]">{valor}</span>
        {complemento && <span className="text-sm text-tinta-suave sm:text-[15px]">{complemento}</span>}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-[13px] text-tinta-suave numeros sm:pt-4 sm:text-sm">
        <span>{rodape}</span>
        <Selo v={variacao} />
      </div>
    </section>
  )
}

const DICA = 'em relação ao mesmo período do mês passado'

/** Linha de resumos do topo: tempo total, desempenho, progresso no edital (com o mês atual) e o versículo do dia */
export function ResumoTopo({ estudos, topicos }: { estudos: Estudo[]; topicos: Topico[] }) {
  const agora = new Date()
  const mes = mesAtual(agora)
  const anterior = mesAnteriorMesmoTrecho(agora)

  const total = somarEstudos(estudos)
  const doMes = somarEstudos(estudosEm(estudos, mes))
  const doAnterior = somarEstudos(estudosEm(estudos, anterior))

  // tempo
  const vTempo = variacaoPct(doMes.segundos, doAnterior.segundos)

  // desempenho
  const pctTotal = porcentagem(total.acertadas, total.feitas)
  const pctMes = porcentagem(doMes.acertadas, doMes.feitas)
  const pctAnterior = porcentagem(doAnterior.acertadas, doAnterior.feitas)
  const pp = pctMes !== null && pctAnterior !== null ? pctMes - pctAnterior : null
  const nivel = nivelAcerto(pctTotal)

  // edital
  const concluidos = topicos.filter((t) => t.concluido)
  const pctEdital = porcentagem(concluidos.length, topicos.length)
  const concluidosMes = concluidos.filter((t) => t.concluido_em && dentro(t.concluido_em, mes)).length
  const concluidosAnterior = concluidos.filter((t) => t.concluido_em && dentro(t.concluido_em, anterior)).length
  const difEdital = concluidosMes - concluidosAnterior

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Cartao
        titulo="Tempo de estudo"
        icone={<Clock className="size-[18px]" aria-hidden />}
        valor={formatarHorasMinutos(total.segundos)}
        rodape={
          <>
            Neste mês: <strong className="font-semibold text-tinta">{formatarHorasMinutos(doMes.segundos)}</strong>
          </>
        }
        variacao={vTempo !== null && vTempo !== 0 ? { texto: `${Math.abs(vTempo)}%`, subiu: vTempo > 0, dica: DICA } : null}
      />
      <Cartao
        titulo="Desempenho"
        icone={<Target className="size-[18px]" aria-hidden />}
        valor={<span className={cn(nivel && textoNivel[nivel])}>{pctTotal === null ? '—' : `${pctTotal}%`}</span>}
        complemento={`(${total.feitas} ${total.feitas === 1 ? 'questão' : 'questões'})`}
        rodape={
          pctMes === null ? (
            'Neste mês: sem questões'
          ) : (
            <>
              Neste mês: <strong className="font-semibold text-tinta">{pctMes}%</strong> <span className="text-xs">({doMes.feitas} q)</span>
            </>
          )
        }
        variacao={pp !== null && pp !== 0 ? { texto: `${Math.abs(pp)} p.p.`, subiu: pp > 0, dica: `pontos percentuais de acerto ${DICA}` } : null}
      />
      <Cartao
        className="col-span-2 sm:col-span-1"
        titulo="Progresso no edital"
        icone={<ClipboardCheck className="size-[18px]" aria-hidden />}
        valor={pctEdital === null ? '—' : `${pctEdital}%`}
        complemento={`(${concluidos.length} de ${topicos.length} tópicos)`}
        rodape={
          <>
            Neste mês: <strong className="font-semibold text-tinta">{concluidosMes}</strong> {concluidosMes === 1 ? 'tópico concluído' : 'tópicos concluídos'}
          </>
        }
        variacao={difEdital !== 0 && (concluidosMes > 0 || concluidosAnterior > 0) ? { texto: String(Math.abs(difEdital)), subiu: difEdital > 0, dica: `tópicos concluídos ${DICA}` } : null}
      />
      <VersiculoMini className="col-span-2 sm:col-span-1" />
    </div>
  )
}
