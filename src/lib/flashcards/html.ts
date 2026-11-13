import { PREFIXO_IMAGENS_FLASH } from '../config'

/*
  O conteúdo dos cartões é HTML simples (como no Anki): negrito, itálico, listas, tabelas e imagens.
  Tudo que entra (importação, editor, colar) passa por limparHtml, que só mantém as tags
  permitidas, sem atributos. As exceções: o src das imagens, aceito só quando aponta para o bucket
  de imagens dos flashcards deste projeto, e as classes de formatação que o editor escreve, sempre
  de uma lista fechada: a cor do marca-texto (<mark class="grifo-…">), a cor e o tamanho do texto
  (<span class="cor-…">, <span class="tam-…">) e o alinhamento do parágrafo (class="alinha-…").
  Cores e alinhamentos escritos no style (Anki, colar) viram a classe mais próxima; o style nunca fica.
  Scripts, estilos e links ficam de fora.
*/

/** Cores do marca-texto, na ordem da paleta do editor (as cores em si ficam no index.css: --c-grifo-*) */
export const CORES_GRIFO = ['amarelo', 'verde', 'azul', 'rosa', 'lilas', 'laranja'] as const
export type CorGrifo = (typeof CORES_GRIFO)[number]
export const ROTULO_GRIFO: Record<CorGrifo, string> = { amarelo: 'Amarelo', verde: 'Verde', azul: 'Azul', rosa: 'Rosa', lilas: 'Lilás', laranja: 'Laranja' }
export const classeGrifo = (cor: CorGrifo) => `grifo-${cor}`

/** A cor de um <mark> pela classe; sem classe conhecida (mark vindo de fora) vale amarelo */
function corDoMark(el: Element): CorGrifo {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/)
  return CORES_GRIFO.find((c) => classes.includes(classeGrifo(c))) ?? 'amarelo'
}

/** Lê uma cor CSS (#hex, rgb(), rgba()) → [r, g, b] de 0 a 1; null se não der (ou se for transparente) */
function lerRgb(valor: string): number[] | null {
  let rgb: number[] | null = null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(valor)?.[1]
  if (hex) rgb = hex.length === 3 ? [...hex].map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const func = /^rgba?\(([^)]+)\)/.exec(valor)?.[1].split(/[\s,/]+/).filter(Boolean)
  if (func && func.length >= 3) {
    if (func[3] !== undefined && parseFloat(func[3]) === 0) return null
    rgb = func.slice(0, 3).map((n) => parseFloat(n))
  }
  if (!rgb || rgb.some((n) => !Number.isFinite(n))) return null
  return rgb.map((n) => Math.max(0, Math.min(255, n)) / 255)
}

/** Matiz (0–360), mais o maior e o menor canal */
function matizDe([r, g, b]: number[]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return { matiz: 0, max, min }
  const m = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
  return { matiz: (m * 60 + 360) % 360, max, min }
}

const valorDoStyle = (style: string | null, propriedade: string) => new RegExp(`(?:^|;)\\s*${propriedade}\\s*:\\s*([^;]+)`, 'i').exec(style ?? '')?.[1].trim().toLowerCase()

/**
 * Cor de fundo escrita no style (grifo do Anki: <span style="background-color: …">) → a cor pastel mais próxima.
 * null quando não é grifo: sem fundo, transparente, branco, cinza ou escuro.
 */
export function corDoFundo(style: string | null): CorGrifo | null {
  const valor = valorDoStyle(style, 'background(?:-color)?')
  if (!valor) return null
  const rgb = lerRgb(valor)
  if (!rgb) return ({ yellow: 'amarelo', lime: 'verde', green: 'verde', cyan: 'azul', aqua: 'azul', blue: 'azul', pink: 'rosa', red: 'rosa', magenta: 'lilas', violet: 'lilas', purple: 'lilas', orange: 'laranja' } as Record<string, CorGrifo>)[valor] ?? null
  const { matiz, max, min } = matizDe(rgb)
  // branco, cinza ou escuro demais não é marca-texto
  if (max - min < 0.12 || max < 0.45) return null
  if (matiz < 20 || matiz >= 330) return 'rosa'
  if (matiz < 45) return 'laranja'
  if (matiz < 70) return 'amarelo'
  if (matiz < 170) return 'verde'
  if (matiz < 260) return 'azul'
  return 'lilas'
}

// ---------- cor, tamanho e alinhamento do texto ----------

/** Cores do texto, na ordem da paleta do editor (as cores em si ficam no index.css: --c-texto-*) */
export const CORES_TEXTO = ['vermelho', 'laranja', 'verde', 'azul', 'roxo', 'rosa'] as const
export type CorTexto = (typeof CORES_TEXTO)[number]
export const ROTULO_COR_TEXTO: Record<CorTexto, string> = { vermelho: 'Vermelho', laranja: 'Laranja', verde: 'Verde', azul: 'Azul', roxo: 'Roxo', rosa: 'Rosa' }
export const classeCor = (cor: CorTexto) => `cor-${cor}`

/** Tamanhos além do normal (o normal é não ter classe) */
export const TAMANHOS_TEXTO = ['pequeno', 'grande', 'enorme'] as const
export type TamanhoTexto = (typeof TAMANHOS_TEXTO)[number]
export const ROTULO_TAMANHO: Record<TamanhoTexto, string> = { pequeno: 'Pequeno', grande: 'Grande', enorme: 'Muito grande' }
export const classeTamanho = (tamanho: TamanhoTexto) => `tam-${tamanho}`

export const ALINHAMENTOS = ['esquerda', 'centro', 'justificado'] as const
export type Alinhamento = (typeof ALINHAMENTOS)[number]
export const classeAlinhamento = (a: Alinhamento) => `alinha-${a}`

/** Blocos que podem levar alinhamento */
const BLOCOS = new Set(['P', 'DIV', 'LI', 'BLOCKQUOTE', 'TD', 'TH'])

/**
 * Cor do texto escrita de fora (style="color: …" ou <font color>) → a cor da paleta mais próxima.
 * null para preto, branco e cinza (viram a cor normal do texto).
 */
export function corDoTexto(valor: string | null | undefined): CorTexto | null {
  const v = (valor ?? '').trim().toLowerCase()
  if (!v) return null
  const rgb = lerRgb(v)
  if (!rgb) return ({ red: 'vermelho', crimson: 'vermelho', orange: 'laranja', green: 'verde', lime: 'verde', blue: 'azul', navy: 'azul', cyan: 'azul', purple: 'roxo', violet: 'roxo', magenta: 'rosa', pink: 'rosa' } as Record<string, CorTexto>)[v] ?? null
  const { matiz, max, min } = matizDe(rgb)
  if (max - min < 0.2) return null
  if (matiz < 20 || matiz >= 345) return 'vermelho'
  if (matiz < 70) return 'laranja'
  if (matiz < 170) return 'verde'
  if (matiz < 260) return 'azul'
  if (matiz < 300) return 'roxo'
  return 'rosa'
}

/** "left", "center", "justify"… → o alinhamento; null para o que não é aceito (direita, vazio) */
export function alinhamentoDe(valor: string | null | undefined): Alinhamento | null {
  const v = (valor ?? '').trim().toLowerCase()
  if (v === 'left' || v === 'start') return 'esquerda'
  if (v === 'center') return 'centro'
  if (v === 'justify') return 'justificado'
  return null
}

/** Classes de cor e tamanho de um trecho (<span>/<font>): as do editor, ou a cor escrita de fora */
function classesDoTrecho(el: Element): string[] {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/)
  const cor = CORES_TEXTO.find((c) => classes.includes(classeCor(c))) ?? corDoTexto(valorDoStyle(el.getAttribute('style'), 'color') ?? el.getAttribute('color'))
  const tamanho = TAMANHOS_TEXTO.find((x) => classes.includes(classeTamanho(x)))
  return [cor && classeCor(cor), tamanho && classeTamanho(tamanho)].filter((x): x is string => !!x)
}

function alinhamentoDoBloco(el: Element): Alinhamento | null {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/)
  return ALINHAMENTOS.find((a) => classes.includes(classeAlinhamento(a))) ?? alinhamentoDe(valorDoStyle(el.getAttribute('style'), 'text-align') ?? el.getAttribute('align'))
}

const PERMITIDAS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI',
  'CODE', 'PRE', 'HR', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
])
// descartadas com todo o conteúdo
const DESCARTAR = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK',
  'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'AUDIO', 'VIDEO', 'CANVAS', 'SOURCE', 'TRACK',
])
const TROCAR: Record<string, string> = { STRONG: 'b', EM: 'i', STRIKE: 's' }

export interface ResultadoLimpeza {
  html: string
  /** imagens recusadas (endereço de fora), trocadas por "[imagem]" */
  imagens: number
}

/** Decide o src de cada imagem: devolve o endereço a usar, ou null para recusar */
export type MapearSrc = (src: string) => string | null

/** Só imagens enviadas para o bucket dos flashcards */
export const srcPermitido: MapearSrc = (src) => (src.startsWith(PREFIXO_IMAGENS_FLASH) && !/["'<>\s]/.test(src) ? src : null)

function copiar(origem: Node, destino: Node, doc: Document, info: { imagens: number }, mapear: MapearSrc) {
  for (const filho of Array.from(origem.childNodes)) {
    if (filho.nodeType === Node.TEXT_NODE) {
      destino.appendChild(doc.createTextNode(filho.textContent ?? ''))
      continue
    }
    if (filho.nodeType !== Node.ELEMENT_NODE) continue
    const tag = (filho as Element).tagName.toUpperCase()
    if (DESCARTAR.has(tag)) continue
    if (tag === 'IMG') {
      const src = mapear((filho as Element).getAttribute('src') ?? '')
      if (src) {
        const img = doc.createElement('img')
        img.setAttribute('src', src)
        destino.appendChild(img)
      } else {
        info.imagens++
        destino.appendChild(doc.createTextNode('[imagem]'))
      }
      continue
    }
    // marca-texto: <mark> com a cor (classe conhecida) ou um trecho com cor de fundo no style (grifo do Anki)
    const grifo = tag === 'MARK' ? corDoMark(filho as Element) : PERMITIDAS.has(tag) ? null : corDoFundo((filho as Element).getAttribute('style'))
    if (grifo) {
      const mark = doc.createElement('mark')
      mark.setAttribute('class', classeGrifo(grifo))
      copiar(filho, mark, doc, info, mapear)
      if (mark.childNodes.length) destino.appendChild(mark)
      continue
    }
    if (PERMITIDAS.has(tag)) {
      const novo = doc.createElement(TROCAR[tag] ?? tag.toLowerCase())
      const alinhamento = BLOCOS.has(tag) ? alinhamentoDoBloco(filho as Element) : null
      if (alinhamento) novo.setAttribute('class', classeAlinhamento(alinhamento))
      copiar(filho, novo, doc, info, mapear)
      destino.appendChild(novo)
    } else if ((tag === 'SPAN' || tag === 'FONT') && classesDoTrecho(filho as Element).length) {
      // cor e tamanho do texto: <span> só com as classes conhecidas
      const span = doc.createElement('span')
      span.setAttribute('class', classesDoTrecho(filho as Element).join(' '))
      copiar(filho, span, doc, info, mapear)
      if (span.childNodes.length) destino.appendChild(span)
    } else {
      // tag desconhecida (span, font, a, h1…): fica só o conteúdo
      copiar(filho, destino, doc, info, mapear)
    }
  }
}

export function limparHtmlComInfo(html: string, mapear: MapearSrc = srcPermitido): ResultadoLimpeza {
  const info = { imagens: 0 }
  if (!html) return { html: '', imagens: 0 }
  const origem = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
  const destino = document.implementation.createHTMLDocument('')
  copiar(origem.body, destino.body, destino, info, mapear)
  let limpo = destino.body.innerHTML
  // tira quebras e espaços sobrando no começo e no fim
  limpo = limpo.replace(/^(\s|&nbsp;|<br>|<div><br><\/div>)+/, '').replace(/(\s|&nbsp;|<br>|<div><br><\/div>)+$/, '')
  return { html: limpo, imagens: info.imagens }
}

export const limparHtml = (html: string) => limparHtmlComInfo(html).html

const ENTIDADES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/** Texto sem tags, para listas, buscas e rótulos (o resultado é exibido como texto, nunca como HTML) */
export function textoPuro(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/tr|hr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTIDADES[e] ?? e)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto comum → HTML (para importação de texto sem HTML) */
export function textoParaHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')
}

/** O campo está vazio de verdade (sem texto e sem imagem)? */
export const vazio = (html: string) => textoPuro(html) === '' && !/<img\b/i.test(html)

/** Endereços das imagens usadas no HTML */
export function imagensDoHtml(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1].replace(/&amp;/g, '&'))
}

/** Prévia em texto para listas: o texto, ou "[imagem]" quando só tem imagem */
export const previa = (html: string) => textoPuro(html) || (/<img\b/i.test(html) ? '[imagem]' : '')
