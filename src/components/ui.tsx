import * as RadixDialog from '@radix-ui/react-dialog'
import { Eye, EyeOff, LoaderCircle, X } from 'lucide-react'
import { forwardRef, useId, useState, type ButtonHTMLAttributes, type RefObject, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { classesNivel, cn, nivelAcerto } from '@/lib/utils'

/* Componentes base da interface, no estilo shadcn/ui (código próprio, sem dependência externa). */

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const variantes: Record<Variante, string> = {
  primario: 'bg-primaria text-sobre-primaria hover:bg-primaria-forte dark:hover:bg-primaria-forte font-semibold',
  secundario: 'bg-superficie text-tinta border border-linha hover:bg-nevoa/60 font-medium',
  fantasma: 'text-tinta-suave hover:bg-nevoa/60 hover:text-tinta font-medium',
  perigo: 'bg-ruim text-white hover:opacity-90 font-semibold dark:text-[#2a1f2d]',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: 'sm' | 'md' | 'icone'
  carregando?: boolean
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = 'primario', tamanho = 'md', carregando, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none select-none',
        tamanho === 'md' && 'h-10 px-4 text-[15px]',
        tamanho === 'sm' && 'h-8 px-3 text-sm rounded-lg',
        tamanho === 'icone' && 'h-9 w-9 rounded-lg',
        variantes[variante],
        className,
      )}
      {...props}
    >
      {carregando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export const campoBase =
  'w-full rounded-xl border border-linha bg-superficie px-3 text-[15px] text-tinta placeholder:text-tinta-suave/70 focus:outline-none focus:ring-2 focus:ring-primaria/40 focus:border-primaria disabled:opacity-60'

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada({ className, ...props }, ref) {
  return <input ref={ref} className={cn(campoBase, 'h-10', className)} {...props} />
})

/** Campo de senha com botão para mostrar/ocultar o que foi digitado */
export const EntradaSenha = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function EntradaSenha({ className, ...props }, ref) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={visivel ? 'text' : 'password'} className={cn(campoBase, 'h-10 pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-tinta-suave hover:text-tinta"
      >
        {visivel ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
      </button>
    </div>
  )
})

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(campoBase, 'py-2 min-h-24 leading-relaxed', className)} {...props} />
})

export const Selecao = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Selecao({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(campoBase, 'h-10 pr-8 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat seta-select', className)} {...props}>
      {children}
    </select>
  )
})

export function Campo({ rotulo, dica, erro, children, htmlFor }: { rotulo: string; dica?: string; erro?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-tinta">
        {rotulo}
      </label>
      {children}
      {erro ? <p className="text-sm text-ruim">{erro}</p> : dica ? <p className="text-sm text-tinta-suave">{dica}</p> : null}
    </div>
  )
}

/** Interruptor liga/desliga com rótulo e descrição (clicar no texto também alterna) */
export function Interruptor({ ligado, aoMudar, rotulo, descricao, className }: { ligado: boolean; aoMudar: (ligado: boolean) => void; rotulo: string; descricao?: string; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-labelledby={`${id}-r`}
        aria-describedby={descricao ? `${id}-d` : undefined}
        onClick={() => aoMudar(!ligado)}
        className={cn('relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors', ligado ? 'bg-primaria' : 'bg-linha')}
      >
        <span
          className={cn(
            'size-5 rounded-full shadow-sm transition-transform',
            ligado ? 'translate-x-[18px] bg-superficie dark:bg-sobre-primaria' : 'translate-x-0.5 bg-superficie dark:bg-tinta-suave',
          )}
        />
      </button>
      <div className="min-w-0 cursor-pointer select-none" onClick={() => aoMudar(!ligado)}>
        <p id={`${id}-r`} className="text-[15px] leading-6 font-semibold text-tinta">
          {rotulo}
        </p>
        {descricao && (
          <p id={`${id}-d`} className="text-sm text-tinta-suave">
            {descricao}
          </p>
        )}
      </div>
    </div>
  )
}

export function Painel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl bg-superficie border border-linha/70', className)}>{children}</section>
}

export function BarraProgresso({ valor, cor, className, rotulo }: { valor: number | null; cor?: string; className?: string; rotulo?: string }) {
  const v = Math.max(0, Math.min(100, valor ?? 0))
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-nevoa', className)}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: cor ?? 'var(--c-primaria)' }} />
    </div>
  )
}

/** Selo de % de acerto com a cor da faixa (vermelho / amarelo / verde) */
export function SeloAcerto({ pct, className }: { pct: number | null; className?: string }) {
  const nivel = nivelAcerto(pct)
  if (pct === null || !nivel) return <span className={cn('text-sm text-tinta-suave', className)}>—</span>
  return <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-sm font-semibold numeros', classesNivel[nivel], className)}>{pct}%</span>
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-tinta-suave" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  )
}

export function Vazio({ icone, titulo, texto, acao }: { icone?: ReactNode; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icone && <div className="mb-3 text-lavanda">{icone}</div>}
      <p className="font-semibold text-tinta">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-tinta-suave">{texto}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}

export function Dialogo({
  aberto,
  aoMudar,
  titulo,
  descricao,
  children,
  largura = 'max-w-lg',
  focoInicial,
  sobreposto,
  noTopo,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  titulo: string
  descricao?: string
  children: ReactNode
  largura?: string
  /** campo que recebe o foco ao abrir (senão, o primeiro botão) */
  focoInicial?: RefObject<HTMLElement | null>
  /** aberto por cima de outro diálogo: fica numa camada acima */
  sobreposto?: boolean
  /** no celular, abre colado no topo (para o teclado não cobrir o conteúdo de uma busca) */
  noTopo?: boolean
}) {
  return (
    <RadixDialog.Root open={aberto} onOpenChange={aoMudar}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn('fixed inset-0 bg-[#2a1f2d]/45 backdrop-blur-[2px] data-[state=open]:animate-[aparecer_150ms_ease-out]', sobreposto ? 'z-[60]' : 'z-40')}
        />
        <RadixDialog.Content
          onOpenAutoFocus={(e) => {
            if (focoInicial?.current) {
              e.preventDefault()
              focoInicial.current.focus()
            }
          }}
          className={cn(
            'fixed inset-x-0 max-h-[92dvh] overflow-y-auto bg-superficie p-5 shadow-2xl',
            noTopo ? 'top-0 rounded-b-3xl pt-[max(1.25rem,env(safe-area-inset-top))]' : 'bottom-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            sobreposto ? 'z-[70]' : 'z-50',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6',
            largura,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-serif text-xl font-medium text-tinta">{titulo}</RadixDialog.Title>
              {descricao ? (
                <RadixDialog.Description className="mt-1 text-sm text-tinta-suave">{descricao}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{titulo}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Botao variante="fantasma" tamanho="icone" aria-label="Fechar">
                <X className="size-5" />
              </Botao>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export function Confirmar({
  aberto,
  aoMudar,
  titulo,
  texto,
  textoBotao,
  aoConfirmar,
  carregando,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  titulo: string
  texto: string
  textoBotao: string
  aoConfirmar: () => void
  carregando?: boolean
}) {
  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo={titulo} largura="max-w-md">
      <p className="text-[15px] leading-relaxed text-tinta-suave">{texto}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => aoMudar(false)}>
          Cancelar
        </Botao>
        <Botao variante="perigo" onClick={aoConfirmar} carregando={carregando}>
          {textoBotao}
        </Botao>
      </div>
    </Dialogo>
  )
}

export function CabecalhoPagina({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[1.85rem] leading-tight font-medium tracking-[-0.01em] text-tinta">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-tinta-suave">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </header>
  )
}
