import { BellOff, ChevronDown, ClipboardCheck, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { Link, useMatch, useNavigate } from 'react-router'
import { useDisciplinas, useTopicos } from '@/hooks/dados'
import { mostrador, useCronometro } from '@/hooks/useCronometro'
import { cn, formatarRelogio } from '@/lib/utils'

const CHAVE_RECOLHIDO = 'cronometro:mini-recolhido'

function lerRecolhido() {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDO) === '1'
  } catch {
    return false
  }
}

/*
  Janelinha do cronômetro que acompanha o usuário pelas outras telas enquanto há tempo no relógio.
  No celular fica logo acima da barra de navegação; no computador, no canto inferior direito.
  Fica dentro do <main> para deixar um espaço no fim da página e não cobrir o último conteúdo.
*/
export function MiniCronometro() {
  const c = useCronometro()
  const naTelaEstudar = useMatch('/estudar') !== null
  const navegar = useNavigate()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const [recolhido, setRecolhido] = useState(lerRecolhido)

  if (naTelaEstudar || !(c.rodando || c.temTempo)) return null

  const recolher = (v: boolean) => {
    setRecolhido(v)
    try {
      localStorage.setItem(CHAVE_RECOLHIDO, v ? '1' : '0')
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }

  const { exibidoMs, progresso, naPausa, timerAcabou, status, podeSalvar } = mostrador(c)
  const r = formatarRelogio(exibidoMs)
  const tempo = r.segundos ? `${r.principal}:${r.segundos}` : r.principal
  const disciplina = (disciplinas.data ?? []).find((d) => d.id === c.disciplinaId)
  const topico = c.topicoId ? (topicos.data ?? []).find((t) => t.id === c.topicoId) : undefined
  const assunto = disciplina ? (topico ? `${disciplina.nome} · ${topico.nome}` : disciplina.nome) : 'Sem disciplina escolhida'
  const mostraProgresso = c.modo !== 'cronometro'

  const ponto = (
    <span
      className={cn('size-2 shrink-0 rounded-full', c.rodando ? (naPausa ? 'bg-lavanda' : 'bg-lilas motion-safe:animate-pulse') : 'bg-sobre-cabecalho/40')}
      aria-hidden
    />
  )

  // com o alarme tocando a janelinha abre sozinha, para o botão de parar ficar à mão
  const mostrarRecolhido = recolhido && !c.alarmeTocando

  const salvar = () => navegar('/estudar', { state: { salvar: true } })

  return (
    <>
      {/* espaço no fim da página para a janelinha não cobrir o conteúdo */}
      <div className={mostrarRecolhido ? 'h-12' : 'h-20'} aria-hidden />

      {mostrarRecolhido ? (
        <button
          type="button"
          onClick={() => recolher(false)}
          aria-label={`Mostrar o cronômetro: ${tempo}, ${status.toLowerCase()}`}
          title="Mostrar o cronômetro"
          className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 flex h-10 items-center gap-2 rounded-full bg-cabecalho pr-4 pl-3.5 text-sobre-cabecalho ring-1 ring-sobre-cabecalho/10 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.55)] lg:right-5 lg:bottom-5"
        >
          {ponto}
          <span className="text-[15px] font-semibold numeros">{tempo}</span>
        </button>
      ) : (
        <section
          aria-label="Cronômetro em andamento"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 overflow-hidden rounded-2xl bg-cabecalho text-sobre-cabecalho ring-1 ring-sobre-cabecalho/10 shadow-[0_16px_40px_-14px_rgb(0_0_0/0.6)] lg:inset-x-auto lg:right-5 lg:bottom-5 lg:w-[23rem]"
        >
          <div className="flex items-center gap-2 py-2 pr-1.5 pl-3.5">
            <Link to="/estudar" title="Abrir o cronômetro" className="min-w-0 flex-1 rounded-lg py-0.5 focus-visible:outline-offset-2">
              <span className="flex items-baseline gap-2">
                <span className="text-[1.35rem] leading-tight font-semibold tracking-tight numeros">{tempo}</span>
                <span className="flex min-w-0 items-center gap-1.5 self-center text-xs font-medium text-sobre-cabecalho/75">
                  {ponto}
                  <span className="truncate">{status}</span>
                </span>
              </span>
              <span className="block truncate text-[13px] text-sobre-cabecalho/75">{assunto}</span>
            </Link>

            {c.alarmeTocando && (
              <button
                type="button"
                onClick={c.pararAlarme}
                aria-label="Parar alarme"
                title="Parar alarme"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-sobre-cabecalho text-cabecalho motion-safe:animate-pulse"
              >
                <BellOff className="size-[18px]" aria-hidden />
              </button>
            )}
            {!c.rodando && podeSalvar && (
              <button
                type="button"
                onClick={salvar}
                aria-label="Salvar estudo"
                title="Salvar estudo"
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
                  timerAcabou ? 'bg-sobre-cabecalho text-cabecalho' : 'text-sobre-cabecalho hover:bg-sobre-cabecalho/15',
                )}
              >
                <ClipboardCheck className="size-[18px]" aria-hidden />
              </button>
            )}
            {!timerAcabou && (
              <button
                type="button"
                onClick={c.rodando ? c.pausar : c.iniciar}
                aria-label={c.rodando ? 'Pausar' : c.decorrido > 0 ? 'Continuar' : 'Iniciar'}
                title={c.rodando ? 'Pausar' : c.decorrido > 0 ? 'Continuar' : 'Iniciar'}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-sobre-cabecalho text-cabecalho transition-transform active:scale-95"
              >
                {c.rodando ? <Pause className="size-[18px]" fill="currentColor" aria-hidden /> : <Play className="ml-0.5 size-[18px]" fill="currentColor" aria-hidden />}
              </button>
            )}
            <button
              type="button"
              onClick={() => recolher(true)}
              aria-label="Recolher o cronômetro"
              title="Recolher"
              className="grid size-8 shrink-0 place-items-center rounded-full text-sobre-cabecalho/70 hover:bg-sobre-cabecalho/15 hover:text-sobre-cabecalho"
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
          {mostraProgresso && (
            <div className="h-[3px] bg-sobre-cabecalho/15" aria-hidden>
              <div className={cn('h-full', naPausa ? 'bg-lavanda' : 'bg-lilas')} style={{ width: `${progresso * 100}%` }} />
            </div>
          )}
        </section>
      )}
    </>
  )
}
