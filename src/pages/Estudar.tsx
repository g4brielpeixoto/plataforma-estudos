import { isToday } from 'date-fns'
import { ClipboardCheck, Pause, Play, RotateCcw, Settings, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { EstudoDialog } from '@/components/EstudoDialog'
import { Botao, Campo, Dialogo, Entrada, Selecao } from '@/components/ui'
import { useDisciplinas, useEstudos, useTopicos } from '@/hooks/dados'
import { CONFIG_PADRAO, useCronometro, type ConfigPomodoro, type Modo } from '@/hooks/useCronometro'
import { cn, formatarDuracao, formatarRelogio } from '@/lib/utils'

const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: 'cronometro', rotulo: 'Cronômetro' },
  { valor: 'timer', rotulo: 'Timer' },
  { valor: 'pomodoro', rotulo: 'Pomodoro' },
]

const OPCOES_TIMER = [15, 25, 45, 60, 90]

function Anel({ progresso, children }: { progresso: number; children: ReactNode }) {
  const raio = 130
  const circ = 2 * Math.PI * raio
  const p = Math.max(0, Math.min(1, progresso))
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
      <svg viewBox="0 0 300 300" className="size-full -rotate-90" aria-hidden>
        <circle cx="150" cy="150" r={raio} fill="none" stroke="var(--c-nevoa)" strokeWidth="10" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * 2 * Math.PI
          const r1 = raio - 18
          const r2 = raio - (i % 3 === 0 ? 30 : 24)
          return (
            <line
              key={i}
              x1={150 + r1 * Math.cos(a)}
              y1={150 + r1 * Math.sin(a)}
              x2={150 + r2 * Math.cos(a)}
              y2={150 + r2 * Math.sin(a)}
              stroke="var(--c-lilas)"
              strokeWidth={i % 3 === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          )
        })}
        <circle
          cx="150"
          cy="150"
          r={raio}
          fill="none"
          stroke="var(--c-primaria)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - p)}
          style={{ transition: 'stroke-dashoffset 300ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function Estudar() {
  const c = useCronometro()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const estudos = useEstudos()
  const [salvando, setSalvando] = useState(false)
  const [configurando, setConfigurando] = useState(false)
  const [minutosPersonalizados, setMinutosPersonalizados] = useState('')

  const topicosDaDisciplina = (topicos.data ?? []).filter((t) => t.disciplina_id === c.disciplinaId)
  const estudadoHoje = useMemo(
    () => (estudos.data ?? []).filter((e) => isToday(new Date(e.data_hora))).reduce((s, e) => s + (e.duracao_segundos ?? 0), 0),
    [estudos.data],
  )

  // o que mostrar no relógio
  const exibidoMs =
    c.modo === 'cronometro' ? c.decorrido : c.modo === 'timer' ? c.alvoTimerMs - c.decorrido : c.duracaoFaseMs - c.decorrido
  const progresso =
    c.modo === 'cronometro' ? (c.decorrido % 3_600_000) / 3_600_000 : c.modo === 'timer' ? c.decorrido / c.alvoTimerMs : c.decorrido / c.duracaoFaseMs
  const relogio = formatarRelogio(exibidoMs)

  const naPausa = c.modo === 'pomodoro' && c.fase !== 'foco'
  const timerAcabou = c.modo === 'timer' && c.decorrido >= c.alvoTimerMs
  const status = c.rodando
    ? naPausa
      ? c.fase === 'pausaLonga'
        ? 'Pausa longa'
        : 'Pausa'
      : 'Estudando'
    : timerAcabou
      ? 'Tempo esgotado'
      : naPausa
        ? c.fase === 'pausaLonga'
          ? 'Hora da pausa longa'
          : 'Hora da pausa'
        : c.decorrido > 0
          ? 'Pausado'
          : c.modo === 'pomodoro' && c.ciclo > 0
            ? 'Pronto para o próximo foco'
            : 'Pronto para começar'

  const abrirSalvar = () => {
    if (c.rodando) c.pausar()
    setSalvando(true)
  }

  const podeSalvar = Math.round(c.estudadoMs / 60_000) >= 1

  return (
    <div className="mx-auto max-w-xl">
      <div role="tablist" aria-label="Modo" className="mx-auto mb-6 grid max-w-sm grid-cols-3 rounded-2xl bg-superficie-2 p-1">
        {MODOS.map((m) => (
          <button
            key={m.valor}
            role="tab"
            aria-selected={c.modo === m.valor}
            disabled={c.modo !== m.valor && c.temTempo}
            title={c.modo !== m.valor && c.temTempo ? 'Salve ou zere o tempo atual antes de trocar de modo' : undefined}
            onClick={() => c.trocarModo(m.valor)}
            className={cn(
              'rounded-xl py-2 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              c.modo === m.valor ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta',
            )}
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Selecao
          aria-label="Disciplina que você vai estudar"
          value={c.disciplinaId}
          onChange={(e) => c.escolherAssunto(e.target.value, '')}
          className="text-sm"
        >
          <option value="">Disciplina (opcional)</option>
          {(disciplinas.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Selecao>
        <Selecao
          aria-label="Tópico que você vai estudar"
          value={c.topicoId}
          onChange={(e) => c.escolherAssunto(c.disciplinaId, e.target.value)}
          disabled={!c.disciplinaId}
          className="text-sm"
        >
          <option value="">Tópico (opcional)</option>
          {topicosDaDisciplina.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Selecao>
      </div>

      <Anel progresso={progresso}>
        <p className={cn('flex items-center gap-2 text-sm font-semibold', c.rodando ? 'text-primaria-forte' : 'text-tinta-suave')}>
          <span className={cn('size-2 rounded-full', c.rodando ? (naPausa ? 'bg-lavanda' : 'bg-primaria animate-pulse') : 'bg-lilas')} aria-hidden />
          {status}
        </p>
        <p className="mt-1 flex items-baseline font-semibold tracking-tight text-tinta numeros" aria-live="off">
          <span className="text-[4.25rem] leading-none sm:text-[4.75rem]">{relogio.principal}</span>
          {relogio.segundos && <span className="ml-1 text-2xl text-tinta-suave">:{relogio.segundos}</span>}
        </p>
        {c.modo === 'pomodoro' && (
          <div className="mt-3 flex gap-1.5" aria-label={`${c.ciclo % c.config.ciclos} de ${c.config.ciclos} focos até a pausa longa`}>
            {Array.from({ length: c.config.ciclos }).map((_, i) => (
              <span key={i} className={cn('size-2 rounded-full', i < c.ciclo % c.config.ciclos || (c.ciclo > 0 && c.ciclo % c.config.ciclos === 0 && c.fase === 'pausaLonga') ? 'bg-primaria' : 'bg-nevoa')} />
            ))}
          </div>
        )}
        {c.modo !== 'cronometro' && c.estudadoMs > 0 && (
          <p className="mt-2 text-sm text-tinta-suave numeros">{formatarDuracao(c.estudadoMs / 1000)} de estudo</p>
        )}
      </Anel>

      {c.modo === 'timer' && !c.rodando && c.decorrido === 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {OPCOES_TIMER.map((m) => (
            <button
              key={m}
              onClick={() => c.definirAlvoTimer(m)}
              className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium numeros', c.alvoTimerMin === m ? 'bg-primaria text-sobre-primaria' : 'bg-superficie-2 text-tinta-suave hover:text-tinta')}
            >
              {m} min
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(minutosPersonalizados)
              if (n > 0) c.definirAlvoTimer(n)
              setMinutosPersonalizados('')
            }}
            className="flex items-center gap-1"
          >
            <Entrada type="number" min={1} max={600} inputMode="numeric" placeholder="outro" aria-label="Minutos do timer" className="h-8 w-20 rounded-full text-sm" value={minutosPersonalizados} onChange={(e) => setMinutosPersonalizados(e.target.value)} />
          </form>
        </div>
      )}

      <div className="mt-8 flex items-start justify-center gap-6 sm:gap-8">
        <BotaoRedondo rotulo="Zerar" onClick={c.zerar} disabled={!c.temTempo}>
          <RotateCcw className="size-5" />
        </BotaoRedondo>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={c.rodando ? c.pausar : c.iniciar}
            disabled={timerAcabou}
            className="grid size-20 place-items-center rounded-full bg-primaria text-sobre-primaria shadow-[0_10px_30px_-8px_var(--c-primaria)] transition-transform hover:bg-primaria-forte active:scale-95 disabled:opacity-40"
            aria-label={c.rodando ? 'Pausar' : 'Iniciar'}
          >
            {c.rodando ? <Pause className="size-8" fill="currentColor" /> : <Play className="ml-1 size-8" fill="currentColor" />}
          </button>
          <span className="text-sm font-semibold text-tinta">{c.rodando ? 'Pausar' : c.decorrido > 0 && !timerAcabou ? 'Continuar' : 'Iniciar'}</span>
        </div>
        <BotaoRedondo rotulo="Salvar" onClick={abrirSalvar} disabled={!podeSalvar}>
          <ClipboardCheck className="size-5" />
        </BotaoRedondo>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-tinta-suave">
        {c.modo === 'pomodoro' && (
          <>
            <Botao variante="fantasma" tamanho="sm" onClick={c.pularFase} disabled={c.decorrido === 0 && !c.rodando}>
              <SkipForward className="size-4" aria-hidden /> {naPausa ? 'Encerrar pausa' : 'Encerrar foco'}
            </Botao>
            <Botao variante="fantasma" tamanho="sm" onClick={() => setConfigurando(true)} disabled={c.rodando}>
              <Settings className="size-4" aria-hidden /> {c.config.foco}/{c.config.pausa} min
            </Botao>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-tinta-suave numeros">
        {estudadoHoje > 0 ? `Hoje você já registrou ${formatarDuracao(estudadoHoje)} de estudo.` : 'Nenhum estudo registrado hoje ainda.'}
        {!podeSalvar && c.temTempo && ' Salvar fica disponível a partir de 1 minuto de estudo.'}
      </p>

      <EstudoDialog
        aberto={salvando}
        aoMudar={setSalvando}
        iniciais={{ duracaoSegundos: Math.round(c.estudadoMs / 1000), origem: c.modo, disciplinaId: c.disciplinaId, topicoId: c.topicoId }}
        aoSalvar={c.zerar}
      />
      <ConfigDialog aberto={configurando} aoMudar={setConfigurando} config={c.config} aoSalvar={c.setConfig} />
    </div>
  )
}

function BotaoRedondo({ rotulo, onClick, disabled, children }: { rotulo: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-3">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={rotulo}
        className="grid size-14 place-items-center rounded-full border border-linha bg-superficie text-tinta-suave transition-colors hover:border-lilas hover:text-tinta disabled:opacity-40"
      >
        {children}
      </button>
      <span className="text-sm font-medium text-tinta-suave">{rotulo}</span>
    </div>
  )
}

function ConfigDialog({ aberto, aoMudar, config, aoSalvar }: { aberto: boolean; aoMudar: (a: boolean) => void; config: ConfigPomodoro; aoSalvar: (c: ConfigPomodoro) => void }) {
  const [valores, setValores] = useState(config)
  useEffect(() => {
    if (aberto) setValores(config)
  }, [aberto, config])
  const campo = (chave: keyof ConfigPomodoro, rotulo: string, max: number) => (
    <Campo rotulo={rotulo} htmlFor={`p-${chave}`}>
      <Entrada
        id={`p-${chave}`}
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
        className="numeros"
        value={valores[chave]}
        onChange={(e) => setValores((v) => ({ ...v, [chave]: Number(e.target.value) }))}
      />
    </Campo>
  )
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const limpo = (n: number, max: number, padrao: number) => (n >= 1 && n <= max ? Math.round(n) : padrao)
    aoSalvar({
      foco: limpo(valores.foco, 180, CONFIG_PADRAO.foco),
      pausa: limpo(valores.pausa, 60, CONFIG_PADRAO.pausa),
      pausaLonga: limpo(valores.pausaLonga, 90, CONFIG_PADRAO.pausaLonga),
      ciclos: limpo(valores.ciclos, 12, CONFIG_PADRAO.ciclos),
    })
    aoMudar(false)
  }
  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo="Ajustes do pomodoro"
      descricao="Só o tempo de foco conta como estudo."
      largura="max-w-md"
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {campo('foco', 'Foco (min)', 180)}
          {campo('pausa', 'Pausa (min)', 60)}
          {campo('pausaLonga', 'Pausa longa (min)', 90)}
          {campo('ciclos', 'Focos até a pausa longa', 12)}
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <Botao type="button" variante="fantasma" onClick={() => setValores(CONFIG_PADRAO)}>
            Restaurar 25/5
          </Botao>
          <Botao type="submit">Salvar ajustes</Botao>
        </div>
      </form>
    </Dialogo>
  )
}
