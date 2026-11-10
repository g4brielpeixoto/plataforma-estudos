import { Bold, Brackets, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { limparHtml, textoParaHtml, textoPuro } from '@/lib/flashcards/html'
import { proximoNumero } from '@/lib/flashcards/omissao'
import { cn } from '@/lib/utils'

export interface CampoRicoRef {
  focar: () => void
}

interface Props {
  id?: string
  valor: string
  aoMudar: (html: string) => void
  placeholder?: string
  /** mostra o botão "Omissão" (Ctrl+Shift+C), que envolve o trecho selecionado em {{cN::…}} */
  omissao?: boolean
  rotulo: string
  invalido?: boolean
  className?: string
}

/*
  Editor de texto com formatação simples, como o editor do Anki.
  O conteúdo é HTML; o que é colado passa pela limpeza (sem estilos, links ou scripts).
  Usa document.execCommand, que todos os navegadores ainda suportam para edição simples.
*/
export const CampoRico = forwardRef<CampoRicoRef, Props>(function CampoRico({ id, valor, aoMudar, placeholder, omissao, rotulo, invalido, className }, ref) {
  const editor = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({ focar: () => editor.current?.focus() }), [])

  // só reescreve o conteúdo quando o valor muda por fora (abrir outro cartão, limpar o formulário)
  useEffect(() => {
    const el = editor.current
    if (el && el.innerHTML !== valor) el.innerHTML = valor
  }, [valor])

  const emitir = () => editor.current && aoMudar(editor.current.innerHTML)

  const comando = (nome: string) => {
    editor.current?.focus()
    document.execCommand(nome)
    emitir()
  }

  const inserirOmissao = () => {
    const el = editor.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    const trecho = sel && el.contains(sel.anchorNode) ? sel.toString() : ''
    const n = proximoNumero(el.innerText)
    document.execCommand('insertText', false, `{{c${n}::${trecho || '...'}}}`)
    emitir()
  }

  const aoColar = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const texto = e.clipboardData.getData('text/plain')
    document.execCommand('insertHTML', false, html ? limparHtml(html) : textoParaHtml(texto))
    emitir()
  }

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (omissao && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      inserirOmissao()
    }
  }

  const vazio = textoPuro(valor) === ''

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-superficie focus-within:border-primaria focus-within:ring-2 focus-within:ring-primaria/40',
        invalido ? 'border-ruim' : 'border-linha',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-linha/70 bg-superficie-2/60 px-1.5 py-1" role="toolbar" aria-label={`Formatação: ${rotulo}`}>
        <BotaoFerramenta rotulo="Negrito (Ctrl+B)" aoClicar={() => comando('bold')}>
          <Bold className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo="Itálico (Ctrl+I)" aoClicar={() => comando('italic')}>
          <Italic className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo="Sublinhado (Ctrl+U)" aoClicar={() => comando('underline')}>
          <Underline className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo="Lista" aoClicar={() => comando('insertUnorderedList')}>
          <List className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo="Lista numerada" aoClicar={() => comando('insertOrderedList')}>
          <ListOrdered className="size-4" />
        </BotaoFerramenta>
        {omissao && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={inserirOmissao}
            title="Esconder o trecho selecionado (Ctrl+Shift+C)"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-primaria px-2.5 text-sm font-semibold text-sobre-primaria hover:bg-primaria-forte"
          >
            <Brackets className="size-4" aria-hidden /> Omissão
          </button>
        )}
      </div>
      <div className="relative">
        {vazio && placeholder && (
          <span className="pointer-events-none absolute inset-x-3 top-2.5 text-[15px] text-tinta-suave/70" aria-hidden>
            {placeholder}
          </span>
        )}
        <div
          id={id}
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={rotulo}
          aria-invalid={invalido || undefined}
          onInput={emitir}
          onBlur={emitir}
          onPaste={aoColar}
          onKeyDown={aoTeclar}
          className="texto-rico min-h-24 px-3 py-2.5 text-[15px] leading-relaxed text-tinta outline-none [overflow-wrap:anywhere]"
        />
      </div>
    </div>
  )
})

function BotaoFerramenta({ rotulo, aoClicar, children }: { rotulo: string; aoClicar: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      // não tira o foco (e a seleção) do editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={aoClicar}
      title={rotulo}
      aria-label={rotulo}
      className="grid size-8 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
    >
      {children}
    </button>
  )
}
