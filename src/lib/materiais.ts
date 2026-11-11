import type { Material } from '@/types'

/*
  Materiais dos tópicos são só links. Aceitamos http e https (o banco recusa o resto);
  quem digita "www.site.com" ou "site.com/arquivo.pdf" ganha o https:// na frente.
*/

/** Texto digitado → endereço válido, ou null */
export function normalizarUrl(texto: string): string | null {
  let t = texto.trim()
  if (!t || /\s/.test(t)) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = `https://${t.replace(/^\/+/, '')}`
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.href.length <= 2000 ? u.href : null
  } catch {
    return null
  }
}

export type TipoMaterial = 'pdf' | 'video' | 'documento' | 'link'

export function tipoMaterial(url: string): TipoMaterial {
  try {
    const u = new URL(url)
    const caminho = u.pathname.toLowerCase()
    const host = u.hostname.replace(/^www\./, '')
    if (caminho.endsWith('.pdf')) return 'pdf'
    if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(host) || /\.(mp4|webm|mov)$/.test(caminho)) return 'video'
    if (/(^|\.)(docs\.google\.com|notion\.so|notion\.site|onedrive\.live\.com)$/.test(host) || /\.(docx?|pptx?|xlsx?|odt|txt|md)$/.test(caminho)) return 'documento'
    return 'link'
  } catch {
    return 'link'
  }
}

/** Nome para mostrar: o título, o nome do arquivo no endereço, ou o site */
export function nomeDoMaterial(m: Pick<Material, 'titulo' | 'url'>): string {
  if (m.titulo?.trim()) return m.titulo.trim()
  try {
    const u = new URL(m.url)
    const ultimo = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
    if (/\.[a-z0-9]{2,5}$/i.test(ultimo)) return ultimo
    return u.hostname.replace(/^www\./, '')
  } catch {
    return m.url
  }
}

export function porTopico(materiais: Material[]) {
  const mapa = new Map<string, Material[]>()
  for (const m of materiais) {
    const l = mapa.get(m.topico_id)
    if (l) l.push(m)
    else mapa.set(m.topico_id, [m])
  }
  return mapa
}
