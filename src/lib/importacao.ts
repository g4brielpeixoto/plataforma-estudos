import type { Disciplina, Topico } from '@/types'
import { normalizar } from './utils'

/** Limpa uma linha colada: tira marcadores de lista (-, •, *) e espaços, mas mantém a numeração (6.2, 1., I -) */
export function limparLinha(linha: string): string {
  return linha
    .replace(/\t/g, ' ')
    .replace(/^\s*[-•*–▪◦·]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface NovoTopico {
  nome: string
  nivel: 0 | 1
}

export interface PreviaTopicos {
  novos: NovoTopico[]
  repetidos: string[]
}

/** Linha recuada (tab ou 2+ espaços no começo) vira subtópico do tópico de cima */
const recuada = (linha: string) => /^(\t| {2,})\S/.test(linha)

/** Uma linha = um tópico. Ignora linhas vazias e tópicos que já existem ou se repetem. */
export function analisarTopicos(texto: string, existentes: string[]): PreviaTopicos {
  const vistos = new Set(existentes.map(normalizar))
  const novos: NovoTopico[] = []
  const repetidos: string[] = []
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = limparLinha(bruta)
    if (!linha) continue
    const chave = normalizar(linha)
    if (vistos.has(chave)) {
      repetidos.push(linha)
      continue
    }
    vistos.add(chave)
    const temAnterior = novos.length > 0 || existentes.length > 0
    novos.push({ nome: linha, nivel: recuada(bruta) && temAnterior ? 1 : 0 })
  }
  return { novos, repetidos }
}

export interface DisciplinaPrevia {
  nome: string
  existente: Disciplina | null
  novos: NovoTopico[]
  repetidos: string[]
}

export interface PreviaEdital {
  disciplinas: DisciplinaPrevia[]
  /** linhas de tópico que vieram antes da primeira disciplina */
  semDisciplina: string[]
}

/** Linhas que começam com # são disciplinas; as seguintes são tópicos dela. */
export function analisarEdital(texto: string, disciplinas: Disciplina[], topicos: Topico[]): PreviaEdital {
  const grupos: { nome: string; linhas: string[] }[] = []
  const semDisciplina: string[] = []
  for (const bruta of texto.split(/\r?\n/)) {
    const titulo = bruta.match(/^\s*#+\s*(.*)$/)
    if (titulo) {
      const nome = limparLinha(titulo[1])
      if (nome) grupos.push({ nome, linhas: [] })
      continue
    }
    const linha = limparLinha(bruta)
    if (!linha) continue
    if (grupos.length === 0) semDisciplina.push(linha)
    else grupos[grupos.length - 1].linhas.push(recuada(bruta) ? `  ${linha}` : linha)
  }

  // junta grupos repetidos (a mesma disciplina aparecendo duas vezes)
  const unidos = new Map<string, { nome: string; linhas: string[] }>()
  for (const g of grupos) {
    const chave = normalizar(g.nome)
    const atual = unidos.get(chave)
    if (atual) atual.linhas.push(...g.linhas)
    else unidos.set(chave, { nome: g.nome, linhas: [...g.linhas] })
  }

  const resultado: DisciplinaPrevia[] = []
  for (const [chave, g] of unidos) {
    const existente = disciplinas.find((d) => normalizar(d.nome) === chave) ?? null
    const nomesExistentes = existente ? topicos.filter((t) => t.disciplina_id === existente.id).map((t) => t.nome) : []
    const { novos, repetidos } = analisarTopicos(g.linhas.join('\n'), nomesExistentes)
    resultado.push({ nome: existente?.nome ?? g.nome, existente, novos, repetidos })
  }
  return { disciplinas: resultado, semDisciplina }
}
