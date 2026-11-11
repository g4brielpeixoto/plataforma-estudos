import { normalizar } from './utils'
import { numeracaoDeTodos } from './topicos'
import type { Topico } from '@/types'

/*
  Busca de tópico por texto ou número.
  Cada palavra digitada precisa aparecer no nome ou bater com a numeração do edital:
  "4" encontra o 4 e os subtópicos 4.1, 4.2…; "4.2" encontra o 4.2 e os de dentro dele; "jornada 4" também funciona.
*/

export interface ItemBusca {
  topico: Topico
  numero: string
  /** nome do tópico de cima (para dar contexto aos subtópicos) */
  pai?: string
}

/** Lista ordenada como no edital (por disciplina, na ordem dos tópicos), com número e pai */
export function itensDeBusca(todos: Topico[], disciplinaId: string | null, ordemDisciplinas: string[]): ItemBusca[] {
  const numeros = numeracaoDeTodos(todos)
  const posDisciplina = new Map(ordemDisciplinas.map((id, i) => [id, i]))
  const lista = todos
    .filter((t) => !disciplinaId || t.disciplina_id === disciplinaId)
    .sort((a, b) => (posDisciplina.get(a.disciplina_id) ?? 0) - (posDisciplina.get(b.disciplina_id) ?? 0) || a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em))
  const ultimoPorNivel: Record<number, Topico | undefined> = {}
  let disciplinaAtual = ''
  return lista.map((t) => {
    if (t.disciplina_id !== disciplinaAtual) {
      disciplinaAtual = t.disciplina_id
      for (const k of Object.keys(ultimoPorNivel)) delete ultimoPorNivel[Number(k)]
    }
    const pai = t.nivel > 0 ? ultimoPorNivel[t.nivel - 1]?.nome : undefined
    ultimoPorNivel[t.nivel] = t
    return { topico: t, numero: numeros.get(t.id) ?? '', pai }
  })
}

export function filtrarBusca(itens: ItemBusca[], termo: string): ItemBusca[] {
  const palavras = normalizar(termo).split(' ').filter(Boolean)
  if (!palavras.length) return itens
  return itens.filter((it) => {
    const nome = normalizar(it.topico.nome)
    return palavras.every((p) => {
      const numerica = /^\d+(\.\d+)*\.?$/.test(p)
      if (!numerica) return nome.includes(p)
      const n = p.replace(/\.$/, '')
      // número: a numeração do edital, ou o número inteiro dentro do nome ("Lei 8.112"), sem pegar pedaço de outro ("12" não acha "112")
      return it.numero === n || it.numero.startsWith(`${n}.`) || new RegExp(`(^|[^\\d.])${n.replace(/\./g, '\\.')}($|[^\\d])`).test(nome)
    })
  })
}
