import { arrayMove } from '@dnd-kit/sortable'
import type { Topico } from '@/types'

/*
  Tópicos e subtópicos ficam numa lista única, na ordem da disciplina.
  Um subtópico (nivel 1) pertence ao tópico de nível 0 que vem logo antes dele.
  Assim a ordem continua simples (um número só) e o recuo é só uma marcação.
*/

export interface Bloco {
  pai: Topico
  filhos: Topico[]
}

/** Garante que a lista não comece com um subtópico */
export function normalizar(lista: Topico[]): Topico[] {
  return lista.map((t, i) => (i === 0 && t.nivel !== 0 ? { ...t, nivel: 0 } : t))
}

export function emBlocos(lista: Topico[]): Bloco[] {
  const blocos: Bloco[] = []
  for (const t of normalizar(lista)) {
    if (t.nivel === 0 || blocos.length === 0) blocos.push({ pai: t, filhos: [] })
    else blocos[blocos.length - 1].filhos.push(t)
  }
  return blocos
}

export const achatar = (blocos: Bloco[]) => blocos.flatMap((b) => [b.pai, ...b.filhos])

/** Numeração exibida: "2" para tópicos, "2.1" para subtópicos */
export function numeracao(lista: Topico[]): Map<string, string> {
  const mapa = new Map<string, string>()
  emBlocos(lista).forEach((b, i) => {
    mapa.set(b.pai.id, String(i + 1))
    b.filhos.forEach((f, j) => mapa.set(f.id, `${i + 1}.${j + 1}`))
  })
  return mapa
}

/** Subtópicos de um tópico */
export function filhosDe(lista: Topico[], id: string): Topico[] {
  return emBlocos(lista).find((b) => b.pai.id === id)?.filhos ?? []
}

/** Tópico pai de um subtópico */
export function paiDe(lista: Topico[], id: string): Topico | undefined {
  return emBlocos(lista).find((b) => b.filhos.some((f) => f.id === id))?.pai
}

/**
 * Arrastar: um tópico leva junto os seus subtópicos e só pousa entre blocos;
 * um subtópico se move sozinho e passa a pertencer ao tópico que ficar acima dele.
 */
export function moverPorArrasto(lista: Topico[], idAtivo: string, idAlvo: string): Topico[] {
  const ativo = lista.find((t) => t.id === idAtivo)
  if (!ativo || idAtivo === idAlvo) return lista
  if (ativo.nivel === 0) {
    const blocos = emBlocos(lista)
    const de = blocos.findIndex((b) => b.pai.id === idAtivo)
    const para = blocos.findIndex((b) => b.pai.id === idAlvo || b.filhos.some((f) => f.id === idAlvo))
    if (de < 0 || para < 0) return lista
    return achatar(arrayMove(blocos, de, para))
  }
  const de = lista.findIndex((t) => t.id === idAtivo)
  const para = lista.findIndex((t) => t.id === idAlvo)
  return normalizar(arrayMove(lista, de, para))
}

/** Digitar a posição: tópicos entre tópicos; subtópicos entre os irmãos */
export function moverParaPosicao(lista: Topico[], id: string, posicao: number): Topico[] {
  const blocos = emBlocos(lista)
  const bi = blocos.findIndex((b) => b.pai.id === id)
  if (bi >= 0) {
    const para = Math.max(0, Math.min(blocos.length - 1, Math.round(posicao) - 1))
    return para === bi ? lista : achatar(arrayMove(blocos, bi, para))
  }
  const b = blocos.find((x) => x.filhos.some((f) => f.id === id))
  if (!b) return lista
  const ci = b.filhos.findIndex((f) => f.id === id)
  const para = Math.max(0, Math.min(b.filhos.length - 1, Math.round(posicao) - 1))
  if (para === ci) return lista
  b.filhos = arrayMove(b.filhos, ci, para)
  return achatar(blocos)
}

/** Tornar subtópico do tópico de cima (só para tópico sem subtópicos e que não é o primeiro) */
export function podeRecuar(lista: Topico[], id: string): boolean {
  const i = lista.findIndex((t) => t.id === id)
  return i > 0 && lista[i].nivel === 0 && filhosDe(lista, id).length === 0
}

export function definirNivel(lista: Topico[], id: string, nivel: 0 | 1): Topico[] {
  return normalizar(lista.map((t) => (t.id === id ? { ...t, nivel } : t)))
}

/** Rótulo para listas de seleção: subtópicos com recuo */
export function rotuloSelecao(t: Topico): string {
  return t.nivel === 1 ? ` ↳ ${t.nome}` : t.nome
}
