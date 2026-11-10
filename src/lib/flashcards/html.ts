/*
  O conteúdo dos cartões é HTML simples (como no Anki): negrito, itálico, listas, tabelas.
  Tudo que entra (importação, editor, colar) passa por limparHtml, que só mantém as tags
  permitidas, sem nenhum atributo. Scripts, estilos, links e imagens ficam de fora.
*/

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
  /** imagens encontradas (substituídas por "[imagem]") */
  imagens: number
}

function copiar(origem: Node, destino: Node, doc: Document, info: { imagens: number }) {
  for (const filho of Array.from(origem.childNodes)) {
    if (filho.nodeType === Node.TEXT_NODE) {
      destino.appendChild(doc.createTextNode(filho.textContent ?? ''))
      continue
    }
    if (filho.nodeType !== Node.ELEMENT_NODE) continue
    const tag = (filho as Element).tagName.toUpperCase()
    if (DESCARTAR.has(tag)) continue
    if (tag === 'IMG') {
      info.imagens++
      destino.appendChild(doc.createTextNode('[imagem]'))
      continue
    }
    if (PERMITIDAS.has(tag)) {
      const novo = doc.createElement(TROCAR[tag] ?? tag.toLowerCase())
      copiar(filho, novo, doc, info)
      destino.appendChild(novo)
    } else {
      // tag desconhecida (span, font, a, h1…): fica só o conteúdo
      copiar(filho, destino, doc, info)
    }
  }
}

export function limparHtmlComInfo(html: string): ResultadoLimpeza {
  const info = { imagens: 0 }
  if (!html) return { html: '', imagens: 0 }
  const origem = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
  const destino = document.implementation.createHTMLDocument('')
  copiar(origem.body, destino.body, destino, info)
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

/** O campo está vazio de verdade (só espaços, quebras ou tags vazias)? */
export const vazio = (html: string) => textoPuro(html) === ''
