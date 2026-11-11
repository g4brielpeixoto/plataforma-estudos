import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/*
  Cronômetro, timer e pomodoro.
  O tempo é calculado a partir do horário de início (Date.now()), e não contando "ticks",
  por isso continua certo com a aba em segundo plano, a tela bloqueada ou a página recarregada.
  O estado fica salvo no navegador (localStorage).
  Existe um relógio só para o app inteiro (CronometroProvider na área logada): ele continua
  contando, avisando no fim do timer/fase e mostrando o tempo no título da aba em qualquer tela,
  e a tela Estudar e o mini cronômetro flutuante (MiniCronometro) leem o mesmo estado.
*/

export type Modo = 'cronometro' | 'timer' | 'pomodoro'
export type Fase = 'foco' | 'pausa' | 'pausaLonga'

export interface ConfigPomodoro {
  foco: number // minutos
  pausa: number
  pausaLonga: number
  ciclos: number // focos até a pausa longa
}

interface Estado {
  modo: Modo
  rodando: boolean
  inicioEm: number | null
  /** tempo já corrido antes do inicioEm (no pomodoro: só da fase atual) */
  acumuladoMs: number
  alvoTimerMin: number
  fase: Fase
  /** quantos focos já foram concluídos */
  ciclo: number
  /** soma dos focos concluídos (pomodoro) */
  focoTotalMs: number
  disciplinaId: string
  topicoId: string
  /** item do planner que originou este estudo ('' se nenhum): ao salvar, ele fica concluído */
  plannerId: string
}

const CHAVE_ESTADO = 'estudar:estado:v1'
const CHAVE_CONFIG = 'estudar:pomodoro:v1'

export const CONFIG_PADRAO: ConfigPomodoro = { foco: 25, pausa: 5, pausaLonga: 15, ciclos: 4 }

const ESTADO_INICIAL: Estado = {
  modo: 'cronometro',
  rodando: false,
  inicioEm: null,
  acumuladoMs: 0,
  alvoTimerMin: 25,
  fase: 'foco',
  ciclo: 0,
  focoTotalMs: 0,
  disciplinaId: '',
  topicoId: '',
  plannerId: '',
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto ? { ...padrao, ...JSON.parse(bruto) } : padrao
  } catch {
    return padrao
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* sem armazenamento: o cronômetro funciona, só não sobrevive a recarregar */
  }
}

// ---------- som e aviso ----------

let audio: AudioContext | null = null

/** Precisa ser chamado num clique, para o navegador liberar o som depois */
function prepararSom() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

function tocarAlarme() {
  if (!audio) return
  const agora = audio.currentTime
  ;[0, 0.35, 0.7].forEach((atraso, i) => {
    const osc = audio!.createOscillator()
    const ganho = audio!.createGain()
    osc.type = 'sine'
    osc.frequency.value = i === 2 ? 880 : 660
    ganho.gain.setValueAtTime(0.0001, agora + atraso)
    ganho.gain.exponentialRampToValueAtTime(0.25, agora + atraso + 0.02)
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.3)
    osc.connect(ganho).connect(audio!.destination)
    osc.start(agora + atraso)
    osc.stop(agora + atraso + 0.32)
  })
}

function avisar(titulo: string, corpo: string) {
  tocarAlarme()
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(titulo, { body: corpo, icon: './favicon.svg' })
    }
  } catch {
    /* notificações indisponíveis */
  }
}

function pedirPermissaoNotificacao() {
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    /* ignorado */
  }
}

// ---------- hook ----------

function useMotorCronometro() {
  const [estado, setEstadoBruto] = useState<Estado>(() => {
    const salvo = ler(CHAVE_ESTADO, ESTADO_INICIAL)
    return salvo.rodando && !salvo.inicioEm ? { ...salvo, rodando: false } : salvo
  })
  const [config, setConfigBruta] = useState<ConfigPomodoro>(() => ler(CHAVE_CONFIG, CONFIG_PADRAO))
  const [agora, setAgora] = useState(() => Date.now())

  const setEstado = useCallback((muda: (e: Estado) => Estado) => {
    setEstadoBruto((anterior) => {
      const novo = muda(anterior)
      gravar(CHAVE_ESTADO, novo)
      return novo
    })
  }, [])

  const setConfig = (c: ConfigPomodoro) => {
    setConfigBruta(c)
    gravar(CHAVE_CONFIG, c)
  }

  const decorrido = estado.acumuladoMs + (estado.rodando && estado.inicioEm ? Math.max(0, agora - estado.inicioEm) : 0)
  const alvoTimerMs = estado.alvoTimerMin * 60_000
  const duracaoFaseMs = (estado.fase === 'foco' ? config.foco : estado.fase === 'pausa' ? config.pausa : config.pausaLonga) * 60_000

  // relógio: atualiza a tela enquanto roda
  useEffect(() => {
    if (!estado.rodando) return
    const id = window.setInterval(() => setAgora(Date.now()), 250)
    const aoVoltar = () => setAgora(Date.now())
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [estado.rodando])

  // fim do timer / fim de fase do pomodoro
  useEffect(() => {
    if (!estado.rodando) return
    if (estado.modo === 'timer' && decorrido >= alvoTimerMs) {
      setEstado((e) => (e.rodando ? { ...e, rodando: false, inicioEm: null, acumuladoMs: alvoTimerMs } : e))
      avisar('Tempo esgotado', `Seu timer de ${estado.alvoTimerMin} min terminou.`)
    }
    if (estado.modo === 'pomodoro' && decorrido >= duracaoFaseMs) {
      setEstado((e) => {
        if (!e.rodando) return e
        if (e.fase === 'foco') {
          const ciclo = e.ciclo + 1
          return {
            ...e,
            rodando: false,
            inicioEm: null,
            acumuladoMs: 0,
            ciclo,
            focoTotalMs: e.focoTotalMs + duracaoFaseMs,
            fase: ciclo % config.ciclos === 0 ? 'pausaLonga' : 'pausa',
          }
        }
        return { ...e, rodando: false, inicioEm: null, acumuladoMs: 0, fase: 'foco' }
      })
      avisar(estado.fase === 'foco' ? 'Hora da pausa' : 'Hora de voltar', estado.fase === 'foco' ? 'Foco concluído. Descanse um pouco.' : 'Pausa encerrada. Vamos ao próximo foco.')
    }
  }, [decorrido, estado.rodando, estado.modo, estado.fase, estado.alvoTimerMin, alvoTimerMs, duracaoFaseMs, config.ciclos, setEstado])

  // título da aba mostra o tempo enquanto roda
  useEffect(() => {
    if (!estado.rodando) {
      document.title = 'Estudos'
      return
    }
    const ms = estado.modo === 'timer' ? alvoTimerMs - decorrido : estado.modo === 'pomodoro' ? duracaoFaseMs - decorrido : decorrido
    const s = Math.max(0, Math.round(ms / 1000))
    const texto = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    document.title = `${texto} · Estudos`
  }, [decorrido, estado.rodando, estado.modo, alvoTimerMs, duracaoFaseMs])

  useEffect(() => () => void (document.title = 'Estudos'), [])

  // aviso ao fechar a página com o tempo rodando
  useEffect(() => {
    if (!estado.rodando) return
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [estado.rodando])

  /** Tempo de estudo efetivo (no pomodoro, só os focos) */
  const estudadoMs =
    estado.modo === 'pomodoro' ? estado.focoTotalMs + (estado.fase === 'foco' ? decorrido : 0) : decorrido

  const temTempo = estudadoMs > 0 || decorrido > 0 || estado.ciclo > 0

  return {
    ...estado,
    config,
    decorrido,
    estudadoMs,
    alvoTimerMs,
    duracaoFaseMs,
    temTempo,
    iniciar() {
      prepararSom()
      if (estado.modo !== 'cronometro') pedirPermissaoNotificacao()
      if (estado.modo === 'timer' && decorrido >= alvoTimerMs) return
      const t = Date.now()
      setAgora(t)
      setEstado((e) => ({ ...e, rodando: true, inicioEm: t }))
    },
    pausar() {
      const t = Date.now()
      setAgora(t)
      setEstado((e) => ({ ...e, rodando: false, inicioEm: null, acumuladoMs: e.acumuladoMs + (e.inicioEm ? t - e.inicioEm : 0) }))
    },
    zerar() {
      setEstado((e) => ({ ...e, rodando: false, inicioEm: null, acumuladoMs: 0, fase: 'foco', ciclo: 0, focoTotalMs: 0, plannerId: '' }))
    },
    trocarModo(modo: Modo) {
      setEstado((e) => (e.rodando ? e : { ...e, modo, acumuladoMs: 0, inicioEm: null, fase: 'foco', ciclo: 0, focoTotalMs: 0 }))
    },
    definirAlvoTimer(min: number) {
      setEstado((e) => ({ ...e, alvoTimerMin: Math.max(1, Math.min(600, Math.round(min))), acumuladoMs: 0 }))
    },
    /** Encerra a fase atual do pomodoro antes da hora (o foco parcial conta como estudo) */
    pularFase() {
      const t = Date.now()
      setEstado((e) => {
        const corrido = e.acumuladoMs + (e.rodando && e.inicioEm ? t - e.inicioEm : 0)
        if (e.fase === 'foco') {
          const ciclo = e.ciclo + 1
          return { ...e, rodando: false, inicioEm: null, acumuladoMs: 0, ciclo, focoTotalMs: e.focoTotalMs + corrido, fase: ciclo % config.ciclos === 0 ? 'pausaLonga' : 'pausa' }
        }
        return { ...e, rodando: false, inicioEm: null, acumuladoMs: 0, fase: 'foco' }
      })
    },
    escolherAssunto(disciplinaId: string, topicoId: string) {
      setEstado((e) => ({ ...e, disciplinaId, topicoId }))
    },
    /** Liga o relógio a um item do planner (ou desliga, com '') */
    vincularPlanner(plannerId: string, disciplinaId?: string, topicoId?: string) {
      setEstado((e) => ({ ...e, plannerId, disciplinaId: disciplinaId ?? e.disciplinaId, topicoId: topicoId ?? e.topicoId }))
    },
    setConfig,
  }
}

export type Cronometro = ReturnType<typeof useMotorCronometro>

const ContextoCronometro = createContext<Cronometro | null>(null)

export function CronometroProvider({ children }: { children: ReactNode }) {
  return createElement(ContextoCronometro.Provider, { value: useMotorCronometro() }, children)
}

export function useCronometro(): Cronometro {
  const c = useContext(ContextoCronometro)
  if (!c) throw new Error('useCronometro precisa estar dentro do CronometroProvider')
  return c
}

/** O que o relógio mostra agora: tempo (contando para cima ou para baixo), progresso e o texto do estado */
export function mostrador(c: Cronometro) {
  // contagem regressiva arredonda para cima: mostra 00:01 até acabar de fato
  const restanteMs = c.modo === 'timer' ? c.alvoTimerMs - c.decorrido : c.duracaoFaseMs - c.decorrido
  const exibidoMs = c.modo === 'cronometro' ? c.decorrido : Math.ceil(Math.max(0, restanteMs) / 1000) * 1000
  const progresso =
    c.modo === 'cronometro' ? (c.decorrido % 3_600_000) / 3_600_000 : c.modo === 'timer' ? c.decorrido / c.alvoTimerMs : c.decorrido / c.duracaoFaseMs
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
  /** salvar só a partir de 1 minuto de estudo */
  const podeSalvar = Math.round(c.estudadoMs / 60_000) >= 1
  return { exibidoMs, progresso: Math.max(0, Math.min(1, progresso)), naPausa, timerAcabou, status, podeSalvar }
}
