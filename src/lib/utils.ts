import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes))
}

/** 9045 s → "2h30min"; 300 s → "5min"; 0 → "0min" */
export function formatarDuracao(segundos: number): string {
  const totalMin = Math.floor(segundos / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}min`
}

/** Com os segundos: 692 s → "11min32s"; 3920 s → "1h05min20s"; 45 s → "45s"; minutos cheios ficam como em formatarDuracao */
export function formatarDuracaoExata(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  const s = total % 60
  if (s === 0) return formatarDuracao(total)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const dois = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}h${dois(m)}min${dois(s)}s`
  if (m > 0) return `${m}min${dois(s)}s`
  return `${s}s`
}

/** Sempre com minutos: 14580 s → "4h03min"; 72000 s → "20h00min" */
export function formatarHorasMinutos(segundos: number): string {
  const totalMin = Math.floor(segundos / 60)
  return `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}min`
}

/** Relógio "01:05:09" ou "05:09" */
export function formatarRelogio(ms: number): { principal: string; segundos: string } {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dois = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? { principal: `${dois(h)}:${dois(m)}`, segundos: dois(s) } : { principal: `${dois(m)}:${dois(s)}`, segundos: '' }
}

export function porcentagem(parte: number, total: number): number | null {
  if (!total) return null
  return Math.round((parte / total) * 100)
}

export type Nivel = 'bom' | 'medio' | 'ruim'

/** Faixas de aproveitamento: ≥ 80% bom, 60–79% médio, < 60% ruim */
export function nivelAcerto(pct: number | null): Nivel | null {
  if (pct === null) return null
  if (pct >= 80) return 'bom'
  if (pct >= 60) return 'medio'
  return 'ruim'
}

export const textoNivel: Record<Nivel, string> = { bom: 'text-bom', medio: 'text-medio', ruim: 'text-ruim' }

export const classesNivel: Record<Nivel, string> = {
  bom: 'bg-bom-fundo text-bom',
  medio: 'bg-medio-fundo text-medio',
  ruim: 'bg-ruim-fundo text-ruim',
}

export function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return 'Algo deu errado. Tente de novo.'
}

/** Normaliza para comparar nomes sem diferenciar maiúsculas, acentos e espaços extras */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome de cada cor da paleta das disciplinas (para leitores de tela e dica do botão) */
export const NOME_COR_DISCIPLINA: Record<string, string> = {
  '#8F7193': 'Lilás',
  '#A788AB': 'Lilás claro',
  '#B5799A': 'Rosa antigo',
  '#7C6FA8': 'Lavanda',
  '#5F8FA3': 'Azul acinzentado',
  '#5E9479': 'Verde sálvia',
  '#A68A4E': 'Ocre',
  '#B4735F': 'Terracota',
  '#6E7686': 'Cinza azulado',
  '#9C6B8C': 'Ameixa',
  '#D9534F': 'Vermelho',
  '#E07B39': 'Laranja',
  '#D4A017': 'Mostarda',
  '#8DAA3B': 'Verde oliva',
  '#3FA36B': 'Verde',
  '#2A9D8F': 'Turquesa',
  '#3A9BC1': 'Azul claro',
  '#3F6FD1': 'Azul',
  '#5B5BD6': 'Índigo',
  '#8E5BD6': 'Violeta',
  '#C254B8': 'Magenta',
  '#E0679A': 'Rosa',
  '#8B5E3C': 'Marrom',
  '#4B5563': 'Grafite',
}

/** Cor escrita por cima de uma cor de fundo qualquer: escura nos fundos claros, branca nos demais */
export function corSobre(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#fff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#2a1f2d' : '#fff'
}

/** Cores para distinguir disciplinas: a paleta lilás e os tons suaves primeiro, depois as cores vivas */
export const CORES_DISCIPLINA = [
  '#8F7193',
  '#A788AB',
  '#B5799A',
  '#7C6FA8',
  '#5F8FA3',
  '#5E9479',
  '#A68A4E',
  '#B4735F',
  '#6E7686',
  '#9C6B8C',
  '#D9534F',
  '#E07B39',
  '#D4A017',
  '#8DAA3B',
  '#3FA36B',
  '#2A9D8F',
  '#3A9BC1',
  '#3F6FD1',
  '#5B5BD6',
  '#8E5BD6',
  '#C254B8',
  '#E0679A',
  '#8B5E3C',
  '#4B5563',
]
