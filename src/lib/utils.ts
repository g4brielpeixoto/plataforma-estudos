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

/** Cores para distinguir disciplinas: a paleta lilás primeiro, depois tons suaves de apoio */
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
]
