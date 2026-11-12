import { PREFIXO_IMAGENS_FLASH } from '../config'

/*
  O conteúdo dos cartões é HTML simples (como no Anki): negrito, itálico, listas, tabelas e imagens.
  Tudo que entra (importação, editor, colar) passa por limparHtml, que só mantém as tags
  permitidas, sem atributos. As exceções: o src das imagens, aceito só quando aponta para o bucket
  de imagens dos flashcards deste projeto, e a cor do marca-texto (<mark class="grifo-…">, só as
  cores de CORES_GRIFO). Scripts, estilos e links ficam de fora.
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

/**
 * Cor de fundo escrita no style (grifo do Anki: <span style="background-color: …">) → a cor pastel mais próxima.
 * null quando não é grifo: sem fundo, transparente, branco, cinza ou escuro.
 */
export function corDoFundo(style: string | null): CorGrifo | null {
  const valor = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(style ?? '')?.[1].trim().toLowerCase()
  if (!valor) return null
  let rgb: number[] | null = null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(valor)?.[1]
  if (hex) rgb = hex.length === 3 ? [...hex].map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const func = /^rgba?\(([^)]+)\)/.exec(valor)?.[1].split(/[\s,/]+/).filter(Boolean)
  if (func && func.length >= 3) {
    if (func[3] !== undefined && parseFloat(func[3]) === 0) return null
    rgb = func.slice(0, 3).map((n) => parseFloat(n))
  }
  if (!rgb) return ({ yellow: 'amarelo', lime: 'verde', green: 'verde', cyan: 'azul', aqua: 'azul', blue: 'azul', pink: 'rosa', red: 'rosa', magenta: 'lilas', violet: 'lilas', purple: 'lilas', orange: 'laranja' } as Record<string, CorGrifo>)[valor] ?? null
  if (rgb.some((n) => !Number.isFinite(n))) return null
  const [r, g, b] = rgb.map((n) => Math.max(0, Math.min(255, n)) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  // branco, cinza ou escuro demais não é marca-texto
  if (max - min < 0.12 || max < 0.45) return null
  let matiz = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
  matiz = (matiz * 60 + 360) % 360
  if (matiz < 20 || matiz >= 330) return 'rosa'
  if (matiz < 45) return 'laranja'
  if (matiz < 70) return 'amarelo'
  if (matiz < 170) return 'verde'
  if (matiz < 260) return 'azul'
  return 'lilas'
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
      copiar(filho, novo, doc, info, mapear)
      destino.appendChild(novo)
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
