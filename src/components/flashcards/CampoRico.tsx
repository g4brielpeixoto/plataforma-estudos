import { ALargeSmall, AlignCenter, AlignJustify, AlignLeft, Baseline, Bold, Brackets, Eraser, Highlighter, ImagePlus, Italic, List, ListOrdered, LoaderCircle, Underline } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { enviarImagemFlash } from '@/hooks/dados'
import {
  ALINHAMENTOS,
  classeAlinhamento,
  classeCor,
  classeGrifo,
  classeTamanho,
  CORES_GRIFO,
  CORES_TEXTO,
  limparHtml,
  ROTULO_COR_TEXTO,
  ROTULO_GRIFO,
  ROTULO_TAMANHO,
  TAMANHOS_TEXTO,
  textoParaHtml,
  vazio as estaVazio,
  type Alinhamento,
  type CorGrifo,
  type CorTexto,
  type TamanhoTexto,
} from '@/lib/flashcards/html'
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
  // faixa aberta embaixo da barra: marca-texto, cor do texto ou tamanho
  const [painel, setPainel] = useState<'grifo' | 'cor' | 'tamanho' | null>(null)
  const alternarPainel = (qual: 'grifo' | 'cor' | 'tamanho') => setPainel((p) => (p === qual ? null : qual))
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

  /** A seleção dentro do editor (com texto selecionado), ou null com um aviso */
  const selecaoComTexto = (aviso: string) => {
    const el = editor.current
    if (!el) return null
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      toast.info(aviso)
      return null
    }
    return el
  }

  /** Tira de um <span> as classes com o prefixo ("cor-" ou "tam-"); sem classe nenhuma, o span some e fica só o conteúdo */
  const tirarClasse = (span: Element, prefixo: string) => {
    for (const c of Array.from(span.classList)) if (c.startsWith(prefixo)) span.classList.remove(c)
    if (!span.classList.length) span.replaceWith(...Array.from(span.childNodes))
  }

  /** Trecho novo dentro de um trecho antigo do mesmo tipo: corta o antigo em volta do novo, para não ficar um dentro do outro */
  const separarAninhados = (el: HTMLElement, seletor: string) => {
    for (let voltas = 0; voltas < 200; voltas++) {
      const interno = el.querySelector(`${seletor} > ${seletor}`)
      const externo = interno?.parentElement
      if (!interno || !externo) break
      const depois = externo.cloneNode(false) as HTMLElement
      while (interno.nextSibling) depois.appendChild(interno.nextSibling)
      externo.after(interno)
      if (depois.childNodes.length) interno.after(depois)
      if (!externo.childNodes.length) externo.remove()
    }
  }

  /**
    Cor do texto: o navegador pinta a seleção com uma cor provisória (foreColor) e cada pedaço pintado
    vira um <span class="cor-…">, que é o que fica gravado no cartão. Sem cor = volta à cor normal.
  */
  const colorir = (cor: CorTexto | null) => {
    const el = selecaoComTexto('Selecione o texto que você quer mudar de cor.')
    if (!el) return
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, COR_PROVISORIA)
    document.execCommand('styleWithCSS', false, 'false')
    const pintados = [...Array.from(el.querySelectorAll<HTMLElement>('[style]')).filter((x) => x.style.color === COR_PROVISORIA), ...Array.from(el.querySelectorAll<HTMLElement>('font[color]'))]
    for (const pintado of pintados) {
      const span = document.createElement('span')
      // os trechos coloridos que ficaram dentro perdem a cor antiga
      for (const antigo of Array.from(pintado.querySelectorAll('span[class*="cor-"]'))) tirarClasse(antigo, 'cor-')
      while (pintado.firstChild) span.appendChild(pintado.firstChild)
      if (pintado.tagName === 'SPAN' || pintado.tagName === 'FONT') {
        // leva junto o tamanho que o trecho já tinha
        for (const c of Array.from(pintado.classList)) if (c.startsWith('tam-')) span.classList.add(c)
        pintado.replaceWith(span)
      } else {
        pintado.style.color = ''
        if (!pintado.getAttribute('style')) pintado.removeAttribute('style')
        pintado.appendChild(span)
      }
      span.classList.add(cor ? classeCor(cor) : 'cor-nenhuma')
    }
    separarAninhados(el, 'span[class*="cor-"]')
    for (const s of Array.from(el.querySelectorAll('span.cor-nenhuma'))) tirarClasse(s, 'cor-')
    el.normalize()
    emitir()
  }

  /** Tamanho do texto: o trecho selecionado vira <span class="tam-…">; null volta ao tamanho normal */
  const redimensionar = (tamanho: TamanhoTexto | null) => {
    const el = selecaoComTexto('Selecione o texto que você quer mudar de tamanho.')
    if (!el) return
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand('fontSize', false, '7')
    const marcados = [...Array.from(el.querySelectorAll<HTMLElement>('font[size]')), ...Array.from(el.querySelectorAll<HTMLElement>('[style]')).filter((x) => x.style.fontSize !== '')]
    for (const marcado of marcados) {
      const span = document.createElement('span')
      for (const antigo of Array.from(marcado.querySelectorAll('span[class*="tam-"]'))) tirarClasse(antigo, 'tam-')
      while (marcado.firstChild) span.appendChild(marcado.firstChild)
      if (marcado.tagName === 'SPAN' || marcado.tagName === 'FONT') {
        for (const c of Array.from(marcado.classList)) if (c.startsWith('cor-')) span.classList.add(c)
        marcado.replaceWith(span)
      } else {
        marcado.style.fontSize = ''
        if (!marcado.getAttribute('style')) marcado.removeAttribute('style')
        marcado.appendChild(span)
      }
      span.classList.add(tamanho ? classeTamanho(tamanho) : 'tam-nenhum')
    }
    separarAninhados(el, 'span[class*="tam-"]')
    for (const s of Array.from(el.querySelectorAll('span.tam-nenhum'))) tirarClasse(s, 'tam-')
    el.normalize()
    emitir()
  }

  /** Os parágrafos (blocos) que a seleção toca, ou o do cursor; `semBloco` diz se sobrou texto solto, fora de qualquer bloco */
  const blocosDaSelecao = (el: HTMLElement) => {
    const sel = window.getSelection()
    const blocos = new Set<HTMLElement>()
    let semBloco = false
    if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return { blocos, semBloco }
    const alcance = sel.getRangeAt(0)
    const blocoDe = (n: Node) => {
      let x = n.nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : n.parentElement
      while (x && x !== el && !BLOCOS_ALINHAVEIS.has(x.tagName)) x = x.parentElement
      return x && x !== el ? x : null
    }
    const nos: Node[] = [alcance.startContainer]
    const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = andar.nextNode(); n; n = andar.nextNode()) if (alcance.intersectsNode(n) && n.textContent?.trim()) nos.push(n)
    for (const n of nos) {
      if (n === el) continue
      const b = blocoDe(n)
      if (b) blocos.add(b)
      else semBloco = true
    }
    if (!blocos.size) semBloco = true
    return { blocos, semBloco }
  }

  /**
    Alinhamento dos parágrafos da seleção (ou de onde o cursor está), gravado como classe no bloco.
    Clicar no alinhamento que o trecho já tem tira o alinhamento (volta ao padrão de onde o cartão aparece).
  */
  const alinhar = (alinhamento: Alinhamento) => {
    const el = editor.current
    if (!el) return
    el.focus()
    let { blocos, semBloco } = blocosDaSelecao(el)
    if (semBloco) {
      // texto solto no editor: o navegador põe a linha num <div>, que é quem recebe o alinhamento
      document.execCommand('formatBlock', false, 'div')
      ;({ blocos, semBloco } = blocosDaSelecao(el))
    }
    if (!blocos.size) return void toast.info('Escreva o texto antes de alinhar.')
    const classe = classeAlinhamento(alinhamento)
    const jaTem = [...blocos].every((b) => b.classList.contains(classe))
    for (const b of blocos) {
      for (const a of ALINHAMENTOS) b.classList.remove(classeAlinhamento(a))
      if (!jaTem) b.classList.add(classe)
      if (!b.classList.length) b.removeAttribute('class')
    }
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
        <BotaoFerramenta rotulo="Alinhar à esquerda" aoClicar={() => alinhar('esquerda')}>
          <AlignLeft className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo="Centralizar" aoClicar={() => alinhar('centro')}>
          <AlignCenter className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo="Justificar" aoClicar={() => alinhar('justificado')}>
          <AlignJustify className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo={painel === 'tamanho' ? 'Fechar o tamanho do texto' : 'Tamanho do texto'} aoClicar={() => alternarPainel('tamanho')} ativo={painel === 'tamanho'}>
          <ALargeSmall className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo={painel === 'cor' ? 'Fechar a cor do texto' : 'Cor do texto'} aoClicar={() => alternarPainel('cor')} ativo={painel === 'cor'}>
          <Baseline className="size-4" />
        </BotaoFerramenta>
        <BotaoFerramenta rotulo={painel === 'grifo' ? 'Fechar o marca-texto' : 'Marca-texto'} aoClicar={() => alternarPainel('grifo')} ativo={painel === 'grifo'}>
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
      {painel === 'grifo' && (
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
      {painel === 'cor' && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-linha/70 bg-superficie-2/40 px-2.5 py-1.5" role="group" aria-label="Cores do texto">
          <span className="mr-0.5 text-xs text-tinta-suave">Selecione o texto e escolha a cor:</span>
          {CORES_TEXTO.map((cor) => (
            <button
              key={cor}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => colorir(cor)}
              title={`Texto ${ROTULO_COR_TEXTO[cor].toLowerCase()}`}
              aria-label={`Texto ${ROTULO_COR_TEXTO[cor].toLowerCase()}`}
              className="size-7 rounded-full border border-tinta/15 transition-transform hover:scale-110"
              style={{ background: `var(--c-texto-${cor})` }}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => colorir(null)}
            className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
          >
            <Eraser className="size-3.5" aria-hidden /> Cor normal
          </button>
        </div>
      )}
      {painel === 'tamanho' && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-linha/70 bg-superficie-2/40 px-2.5 py-1.5" role="group" aria-label="Tamanho do texto">
          <span className="mr-0.5 text-xs text-tinta-suave">Selecione o texto e escolha o tamanho:</span>
          {([TAMANHOS_TEXTO[0], null, TAMANHOS_TEXTO[1], TAMANHOS_TEXTO[2]] as (TamanhoTexto | null)[]).map((tam) => (
            <button
              key={tam ?? 'normal'}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => redimensionar(tam)}
              className="inline-flex h-7 items-center rounded-lg border border-linha bg-superficie px-2.5 text-xs font-medium text-tinta hover:border-lilas"
            >
              {tam ? ROTULO_TAMANHO[tam] : 'Normal'}
            </button>
          ))}
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

const BLOCOS_ALINHAVEIS = new Set(['P', 'DIV', 'LI', 'BLOCKQUOTE', 'TD', 'TH'])

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
