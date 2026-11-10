import { differenceInCalendarDays } from 'date-fns'
import type { Prova } from '@/types'

/** "2027-01-17" → data local (sem fuso), para não virar o dia anterior */
export function dataDaProva(p: Pick<Prova, 'data'>): Date {
  const [a, m, d] = p.data.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Dias que faltam (0 = hoje; negativo = já passou) */
export const diasParaProva = (p: Pick<Prova, 'data'>, hoje = new Date()) => differenceInCalendarDays(dataDaProva(p), hoje)

/** "dom., 17 de jan. de 2027" */
export const dataProvaPorExtenso = (p: Pick<Prova, 'data'>) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(dataDaProva(p))

/** Provas de hoje em diante, da mais próxima para a mais distante */
export const provasFuturas = (provas: Prova[], hoje = new Date()) =>
  provas.filter((p) => diasParaProva(p, hoje) >= 0).sort((a, b) => a.data.localeCompare(b.data))

/** Selo curto para a lista: "Faltam 68 dias", "Falta 1 dia", "É hoje", "Realizada" */
export function seloProva(p: Pick<Prova, 'data'>, hoje = new Date()): string {
  const d = diasParaProva(p, hoje)
  if (d > 1) return `Faltam ${d} dias`
  if (d === 1) return 'Falta 1 dia'
  if (d === 0) return 'É hoje'
  return 'Realizada'
}
