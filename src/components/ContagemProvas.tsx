import { CalendarClock, ChevronDown, ChevronUp, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useProvas } from '@/hooks/dados'
import { dataProvaPorExtenso, diasParaProva, provasFuturas } from '@/lib/provas'
import { cn } from '@/lib/utils'
import { ProvasDialog } from './ProvasDialog'
import { Botao } from './ui'

/** Tempo que cada prova fica na tela antes de trocar (quando há mais de uma) */
const INTERVALO_MS = 6000

function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const mudar = () => setReduzido(mq.matches)
    mq.addEventListener('change', mudar)
    return () => mq.removeEventListener('change', mudar)
  }, [])
  return reduzido
}

/** Contagem regressiva das provas; com mais de uma, alterna entre elas com animação */
export function ContagemProvas({ className }: { className?: string }) {
  const provas = useProvas()
  const [configurando, setConfigurando] = useState(false)
  const [indice, setIndice] = useState(0)
  const [direcao, setDirecao] = useState<1 | -1>(1)
  const [pausado, setPausado] = useState(false)
  const reduzido = useMovimentoReduzido()

  const futuras = useMemo(() => provasFuturas(provas.data ?? []), [provas.data])
  const n = futuras.length
  const i = n ? indice % n : 0
  const atual = futuras[i]

  const ir = (passo: 1 | -1) => {
    setDirecao(passo)
    setIndice((v) => (((v + passo) % n) + n) % n)
  }

  if (provas.isLoading) return null

  if (!atual)
    return (
      <div className={cn('flex items-center gap-4 rounded-2xl border border-dashed border-lilas bg-superficie/60 p-5', className)}>
        <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-nevoa text-primaria-forte sm:grid dark:text-primaria">
          <CalendarClock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-tinta">Quando é a sua prova?</p>
          <p className="text-sm text-tinta-suave">Cadastre a data para ver quantos dias faltam.</p>
        </div>
        <Botao variante="secundario" tamanho="sm" onClick={() => setConfigurando(true)} className="shrink-0">
          Cadastrar
        </Botao>
        <ProvasDialog aberto={configurando} aoMudar={setConfigurando} />
      </div>
    )

  const dias = diasParaProva(atual)
  const animacao = reduzido ? undefined : `${direcao === 1 ? 'prova-entra-baixo' : 'prova-entra-cima'} 450ms cubic-bezier(.2,.8,.2,1)`
  const alterna = n > 1

  return (
    <section
      aria-label="Contagem regressiva das provas"
      aria-roledescription={alterna ? 'carrossel' : undefined}
      className={cn('relative flex overflow-hidden rounded-2xl border border-linha/70 bg-superficie', className)}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      {/* nome e data */}
      <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-5 pr-2 pl-5 sm:pl-6">
        <div key={`${atual.id}-${i}`} className="min-w-0 flex-1" style={{ animation: animacao }} aria-live={alterna && !pausado ? 'off' : 'polite'}>
          <p className="truncate text-lg font-semibold text-tinta sm:text-xl" title={atual.nome}>
            {atual.nome}
          </p>
          <p className="mt-0.5 text-sm text-tinta-suave">{dataProvaPorExtenso(atual)}</p>
        </div>

        {alterna && (
          <div className="flex shrink-0 flex-col items-center">
            <button onClick={() => ir(-1)} aria-label="Prova anterior" className="grid size-7 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta">
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <div className="my-0.5 flex flex-col items-center gap-1" aria-label={`Prova ${i + 1} de ${n}`}>
              {n <= 6 ? (
                futuras.map((p, k) => <span key={p.id} className={cn('w-1 rounded-full transition-all', k === i ? 'h-3 bg-primaria' : 'h-1 bg-lilas')} />)
              ) : (
                <span className="text-[10px] font-semibold text-tinta-suave numeros">
                  {i + 1}/{n}
                </span>
              )}
            </div>
            <button onClick={() => ir(1)} aria-label="Próxima prova" className="grid size-7 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta">
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
        )}

        {/* barra que enche até trocar de prova; para quando o mouse ou o foco está no card */}
        {alterna && !reduzido && (
          <span
            key={`progresso-${i}`}
            aria-hidden
            onAnimationEnd={() => ir(1)}
            className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-lilas/70"
            style={{ animation: `progresso-prova ${INTERVALO_MS}ms linear forwards`, animationPlayState: pausado ? 'paused' : 'running' }}
          />
        )}
      </div>

      {/* dias que faltam */}
      <div className="relative flex w-[9.5rem] shrink-0 flex-col justify-center border-l border-linha/70 bg-nevoa/70 px-4 py-4 sm:w-40">
        <button
          onClick={() => setConfigurando(true)}
          aria-label="Gerenciar datas das provas"
          title="Gerenciar datas das provas"
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg text-tinta-suave hover:bg-perola/80 hover:text-tinta"
        >
          <Settings className="size-[18px]" aria-hidden />
        </button>
        <div key={`dias-${atual.id}-${i}`} style={{ animation: animacao }}>
          {dias === 0 ? (
            <>
              <p className="text-sm text-tinta-suave">É hoje!</p>
              <p className="text-[2.1rem] leading-tight font-medium text-primaria-forte dark:text-primaria">Boa prova</p>
            </>
          ) : (
            <>
              <p className="text-sm text-tinta-suave">{dias === 1 ? 'Falta' : 'Faltam'}</p>
              <p className="text-[2.6rem] leading-none font-semibold tracking-tight text-primaria-forte numeros dark:text-primaria">{dias}</p>
              <p className="mt-1 text-sm leading-tight text-tinta-suave">{dias === 1 ? 'dia para a prova' : 'dias para a prova'}</p>
            </>
          )}
        </div>
      </div>

      <ProvasDialog aberto={configurando} aoMudar={setConfigurando} />
    </section>
  )
}
