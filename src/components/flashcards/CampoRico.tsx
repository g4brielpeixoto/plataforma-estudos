import { Bold, Brackets, Eraser, Highlighter, ImagePlus, Italic, List, ListOrdered, LoaderCircle, Underline } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { enviarImagemFlash } from '@/hooks/dados'
import { classeGrifo, CORES_GRIFO, limparHtml, ROTULO_GRIFO, textoParaHtml, vazio as estaVazio, type CorGrifo } from '@/lib/flashcards/html'
import { proximoNumero } from '@/lib/flashcards/omissao'
import { cn, mensagemErro } from '@/lib/utils'

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
  /** avisa quantas imagens estão sendo enviadas (para segurar o "Salvar" até terminar) */
  aoEnviar?: (quantas: number) => void
}

/*
  Editor de texto com formatação simples, como o editor do Anki.
  O conteúdo é HTML; o que é colado passa pela limpeza (sem estilos, links ou scripts).
  Imagens: botão, colar (print da tela) ou arrastar. Elas vão para o bucket e entram no texto pelo endereço.
  Usa document.execCommand, que todos os navegadores ainda suportam para edição simples.
*/
export const CampoRico = forwardRef<CampoRicoRef, Props>(function CampoRico({ id, valor, aoMudar, placeholder, omissao, rotulo, invalido, className, aoEnviar }, ref) {
  const editor = useRef<HTMLDivElement>(null)
  const seletor = useRef<HTMLInputElement>(null)
  // onde o cursor estava (para a imagem entrar no lugar certo depois do envio)
  const cursor = useRef<Range | null>(null)
  const [enviando, setEnviando] = useState(0)
  const [paleta, setPaleta] = useState(false)
  const [corGrifo, setCorGrifo] = useState<CorGrifo | null>(null)

  const mudarEnvio = (delta: number) =>
    setEnviando((n) => {
      const novo = Math.max(0, n + delta)
      aoEnviar?.(novo)
      return novo
    })

  const guardarCursor = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount && editor.current?.contains(sel.anchorNode)) cursor.current = sel.getRangeAt(0).cloneRange()
  }

  useImperativeHandle(ref, () => ({ focar: () => editor.current?.focus() }), [])

  // só reescreve o conteúdo quando o valor muda por fora (abrir outro cartão, limpar o formulário)
  useEffect(() => {
    const el = editor.current
    if (el && el.innerHTML !== valor) el.innerHTML = valor
  }, [valor])

  const emitir = () => {
    guardarCursor()
    if (editor.current) aoMudar(editor.current.innerHTML)
  }

  const inserirImagens = async (arquivos: File[]) => {
    const imagens = arquivos.filter((f) => f.type.startsWith('image/'))
    if (!imagens.length) return
    mudarEnvio(imagens.length)
    for (const arquivo of imagens) {
      try {
        const url = await enviarImagemFlash(arquivo)
        const el = editor.current
        if (!el) continue
        el.focus()
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          if (cursor.current && el.contains(cursor.current.startContainer)) sel.addRange(cursor.current)
          else {
            const fim = document.createRange()
            fim.selectNodeContents(el)
            fim.collapse(false)
            sel.addRange(fim)
          }
        }
        document.execCommand('insertImage', false, url)
        emitir()
      } catch (e) {
        toast.error(`Não deu para enviar a imagem: ${mensagemErro(e)}`)
      } finally {
        mudarEnvio(-1)
      }
    }
  }

  const comando = (nome: string) => {
    editor.current?.focus()
    document.execCommand(nome)
    emitir()
  }

  /**
    Marca-texto: grifa o trecho selecionado com a cor escolhida.
    O navegador pinta a seleção com uma cor de fundo provisória (hiliteColor) e cada pedaço pintado
    vira um <mark class="grifo-…">, que é o que fica gravado no cartão.
  */
  const grifar = (cor: CorGrifo) => {
    const el = editor.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) return void toast.info('Selecione o trecho que você quer grifar.')
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('hiliteColor', false, COR_PROVISORIA)
    document.execCommand('styleWithCSS', false, 'false')
    for (const pintado of Array.from(el.querySelectorAll<HTMLElement>('[style]'))) {
      if (pintado.style.backgroundColor !== COR_PROVISORIA) continue
      const mark = document.createElement('mark')
      mark.className = classeGrifo(cor)
      while (pintado.firstChild) mark.appendChild(pintado.firstChild)
      pintado.replaceWith(mark)
    }
    // grifo novo dentro de um grifo antigo: corta o antigo em volta do novo, para não ficar um dentro do outro
    for (let voltas = 0; voltas < 200; voltas++) {
      const interno = Array.from(el.querySelectorAll('mark > mark'))[0]
      const externo = interno?.parentElement
      if (!interno || !externo) break
      const depois = externo.cloneNode(false) as HTMLElement
      while (interno.nextSibling) depois.appendChild(interno.nextSibling)
      externo.after(interno)
      if (depois.childNodes.length) interno.after(depois)
      if (!externo.childNodes.length) externo.remove()
    }
    setCorGrifo(cor)
    emitir()
  }

  /** Tira o grifo de todo trecho grifado que a seleção toca (ou onde o cursor está) */
  const tirarGrifo = () => {
    const el = editor.current
    const sel = window.getSelection()
    if (!el || !sel?.rangeCount || !el.contains(sel.anchorNode)) return
    const alcance = sel.getRangeAt(0)
    for (const mark of Array.from(el.querySelectorAll('mark'))) {
      if (!alcance.intersectsNode(mark)) continue
      mark.replaceWith(...Array.from(mark.childNodes))
    }
    el.normalize()
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
    // imagem copiada (print da tela, "copiar imagem"): envia
    const arquivos = Array.from(e.clipboardData.files)
    if (arquivos.some((f) => f.type.startsWith('image/'))) {
      guardarCursor()
      void inserirImagens(arquivos)
      return
    }
    const html = e.clipboardData.getData('text/html')
    const texto = e.clipboardData.getData('text/plain')
    document.execCommand('insertHTML', false, html ? limparHtml(html) : textoParaHtml(texto))
    emitir()
  }

  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    const arquivos = Array.from(e.dataTransfer.files)
    if (!arquivos.some((f) => f.type.startsWith('image/'))) return
    e.preventDefault()
    // põe o cursor onde a imagem foi solta
    const ponto = document.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (ponto && editor.current?.contains(ponto.startContainer)) cursor.current = ponto
    void inserirImagens(arquivos)
  }

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (omissao && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      inserirOmissao()
    }
  }

  const vazio = estaVazio(valor)

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
        <BotaoFerramenta rotulo={paleta ? 'Fechar o marca-texto' : 'Marca-texto'} aoClicar={() => setPaleta((v) => !v)} ativo={paleta}>
          <Highlighter className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta
          rotulo="Imagem (também dá para colar ou arrastar)"
          aoClicar={() => {
            guardarCursor()
            seletor.current?.click()
          }}
        >
          <ImagePlus className="size-4" />
        </BotaoFerramenta>
        <input
          ref={seletor}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void inserirImagens(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        {enviando > 0 && (
          <span className="ml-1 inline-flex items-center gap-1.5 text-xs text-tinta-suave" role="status">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Enviando imagem…
          </span>
        )}
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
      {paleta && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-linha/70 bg-superficie-2/40 px-2.5 py-1.5" role="group" aria-label="Cores do marca-texto">
          <span className="mr-0.5 text-xs text-tinta-suave">Selecione o texto e escolha a cor:</span>
          {CORES_GRIFO.map((cor) => (
            <button
              key={cor}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => grifar(cor)}
              title={`Grifar de ${ROTULO_GRIFO[cor].toLowerCase()}`}
              aria-label={`Grifar de ${ROTULO_GRIFO[cor].toLowerCase()}`}
              aria-pressed={corGrifo === cor}
              className={cn('size-7 rounded-full border border-tinta/15 transition-transform hover:scale-110', corGrifo === cor && 'ring-2 ring-primaria ring-offset-2 ring-offset-superficie')}
              style={{ background: `var(--c-grifo-${cor})` }}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={tirarGrifo}
            className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
          >
            <Eraser className="size-3.5" aria-hidden /> Tirar grifo
          </button>
        </div>
      )}
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
          onKeyUp={guardarCursor}
          onMouseUp={guardarCursor}
          onPaste={aoColar}
          onDrop={aoSoltar}
          onKeyDown={aoTeclar}
          className="texto-rico min-h-24 px-3 py-2.5 text-[15px] leading-relaxed text-tinta outline-none [overflow-wrap:anywhere]"
        />
      </div>
    </div>
  )
})

/** cor de fundo provisória que o navegador aplica na seleção antes de virar <mark> (não fica gravada) */
const COR_PROVISORIA = 'rgb(254, 253, 1)'

function BotaoFerramenta({ rotulo, aoClicar, ativo, children }: { rotulo: string; aoClicar: () => void; ativo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      // não tira o foco (e a seleção) do editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={aoClicar}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={cn('grid size-8 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta', ativo && 'bg-nevoa text-tinta')}
    >
      {children}
    </button>
  )
}
