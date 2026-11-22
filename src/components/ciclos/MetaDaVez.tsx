import { Play, RefreshCcw, SkipForward } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Botao, BarraProgresso, Painel } from '@/components/ui'
import type { CicloDados } from '@/hooks/useCicloDados'
import { siglaDe, topicoParaComecar } from '@/lib/ciclos'
import { cn, porcentagem } from '@/lib/utils'

/** Cartão "Meta da vez": no Início e no topo do Ciclos */
export function MetaDaVez({ dados, aoAbrir, comPular, className }: { dados: CicloDados; aoAbrir: (metaId: string) => void; comPular?: boolean; className?: string }) {
  const navegar = useNavigate()
  const { metaDaVez: s, disciplinaDaVez: d } = dados

  if (!s || !d) {
    const semCiclo = dados.sequencia.length === 0
    return (
      <Painel className={cn('p-5 sm:p-6', className)}>
        <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Meta da vez</h2>
        <p className="mt-3 text-[15px] text-tinta-suave">
          {semCiclo
            ? 'Divida suas disciplinas em metas e monte a ordem do ciclo para saber sempre o que estudar agora.'
            : dados.terminou
              ? 'Todas as metas do ciclo estão cumpridas. Parabéns! Divida mais tópicos em metas ou inclua outras disciplinas no ciclo.'
              : 'Nenhuma disciplina do ciclo tem metas ainda. Divida as disciplinas em metas para começar.'}
        </p>
        <Link to="/ciclos" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-nevoa px-4 text-[15px] font-medium text-tinta hover:bg-nevoa/70">
          <RefreshCcw className="size-4" aria-hidden /> Ir para Ciclos
        </Link>
      </Painel>
    )
  }

  const pct = porcentagem(s.concluidos, s.topicos.length) ?? 0
  const comecar = () => {
    const t = topicoParaComecar(s)
    navegar('/estudar', { state: { comecar: { disciplinaId: d.id, topicoId: t?.id } } })
  }

  return (
    <Painel className={cn('relative overflow-hidden p-5 sm:p-6', className)}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: d.cor }} aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Meta da vez</h2>
        <span className="text-xs text-tinta-suave numeros">
          {dados.posicao + 1}º de {dados.sequencia.length} no ciclo
        </span>
      </div>
      <button type="button" onClick={() => aoAbrir(s.meta.id)} className="mt-2 block w-full text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-tinta-suave">
          <span className="size-2.5 rounded-full" style={{ background: d.cor }} aria-hidden />
          {d.nome}
        </span>
        <span className="mt-1 block text-xl leading-snug font-medium text-tinta hover:underline sm:text-[1.4rem]">
          <span className="numeros">
            {siglaDe(d)} · Meta {s.numero}
          </span>
          <span className="text-tinta-suave"> — </span>
          {s.meta.nome}
        </span>
      </button>
      <div className="mt-4 flex items-center gap-3">
        <BarraProgresso valor={pct} cor="var(--c-visto)" rotulo="Assuntos concluídos da meta" />
        <span className="shrink-0 text-sm text-tinta-suave numeros">
          {s.concluidos} de {s.topicos.length} {s.topicos.length === 1 ? 'assunto' : 'assuntos'}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Botao onClick={comecar}>
          <Play className="size-4" aria-hidden /> Começar
        </Botao>
        <Botao variante="secundario" onClick={() => aoAbrir(s.meta.id)}>
          Ver assuntos
        </Botao>
        {comPular && (
          <Botao variante="fantasma" onClick={dados.pular} title="Passa para a próxima disciplina do ciclo; esta meta continua pendente e volta na próxima vez">
            <SkipForward className="size-4" aria-hidden /> Pular
          </Botao>
        )}
      </div>
    </Painel>
  )
}
