import { arrayMove } from '@dnd-kit/sortable'
import type { NivelTopico, Topico } from '@/types'

/*
  Tópicos ficam numa lista única, na ordem da disciplina, com um nível:
  0 = tópico, 1 = subtópico, 2 = subtópico do subtópico.
  Cada item pertence ao item mais próximo acima dele com um nível a menos.
  A "subárvore" de um item é ele mais os itens seguintes com nível maior.
*/

export const NIVEL_MAXIMO: NivelTopico = 2

/** Garante uma árvore válida: começa no nível 0 e nunca pula mais de um nível para baixo */
export function normalizar(lista: Topico[]): Topico[] {
  let anterior = -1
  return lista.map((t) => {
    const nivel = Math.max(0, Math.min(t.nivel, anterior + 1, NIVEL_MAXIMO)) as NivelTopico
    anterior = nivel
    return nivel === t.nivel ? t : { ...t, nivel }
  })
}

/** Índice (exclusivo) onde termina a subárvore que começa em i */
export function fimSubarvore(lista: Topico[], i: number): number {
  let j = i + 1
  while (j < lista.length && lista[j].nivel > lista[i].nivel) j++
  return j
}

const indice = (lista: Topico[], id: string) => lista.findIndex((t) => t.id === id)

/** Todos os itens abaixo de um tópico (filhos, netos) */
export function descendentesDe(lista: Topico[], id: string): Topico[] {
  const i = indice(lista, id)
  return i < 0 ? [] : lista.slice(i + 1, fimSubarvore(lista, i))
}

/** Só os filhos diretos */
export function filhosDe(lista: Topico[], id: string): Topico[] {
  const i = indice(lista, id)
  if (i < 0) return []
  return descendentesDe(lista, id).filter((t) => t.nivel === lista[i].nivel + 1)
}

export function paiDe(lista: Topico[], id: string): Topico | undefined {
  const i = indice(lista, id)
  if (i <= 0 || lista[i].nivel === 0) return undefined
  for (let k = i - 1; k >= 0; k--) if (lista[k].nivel === lista[i].nivel - 1) return lista[k]
  return undefined
}

/** Itens no mesmo nível e com o mesmo pai */
export function irmaosDe(lista: Topico[], id: string): Topico[] {
  const pai = paiDe(lista, id)
  return pai ? filhosDe(lista, pai.id) : lista.filter((t) => t.nivel === 0)
}

/** Numeração exibida: "4", "4.2", "4.2.1" */
export function numeracao(lista: Topico[]): Map<string, string> {
  const mapa = new Map<string, string>()
  const contador = [0, 0, 0]
  for (const t of normalizar(lista)) {
    contador[t.nivel]++
    for (let k = t.nivel + 1; k < contador.length; k++) contador[k] = 0
    mapa.set(t.id, contador.slice(0, t.nivel + 1).join('.'))
  }
  return mapa
}

/**
 * Arrastar: o item leva junto tudo o que está abaixo dele.
 * Ele pousa antes (subindo) ou depois (descendo) do alvo — ou do "ancestral" do alvo
 * que tem o mesmo nível dele — e mantém o nível sempre que possível.
 */
export function moverPorArrasto(lista: Topico[], idAtivo: string, idAlvo: string): Topico[] {
  const L = normalizar(lista)
  const a = indice(L, idAtivo)
  const alvo = indice(L, idAlvo)
  if (a < 0 || alvo < 0) return lista
  const fimA = fimSubarvore(L, a)
  if (alvo >= a && alvo < fimA) return lista

  const nivelA = L[a].nivel
  let ancora = L[alvo]
  while (ancora.nivel > nivelA) ancora = paiDe(L, ancora.id) ?? ancora

  const fatia = L.slice(a, fimA)
  const resto = [...L.slice(0, a), ...L.slice(fimA)]
  let pos = indice(resto, ancora.id)
  if (alvo > a) pos = fimSubarvore(resto, pos)

  const anterior = pos > 0 ? resto[pos - 1].nivel : -1
  const delta = Math.min(nivelA, anterior + 1) - nivelA
  const movida = fatia.map((t) => ({ ...t, nivel: (t.nivel + delta) as NivelTopico }))
  return normalizar([...resto.slice(0, pos), ...movida, ...resto.slice(pos)])
}

/** Digitar a posição: o item (com o que está abaixo dele) muda de lugar entre os irmãos */
export function moverParaPosicao(lista: Topico[], id: string, posicao: number): Topico[] {
  const L = normalizar(lista)
  const pai = paiDe(L, id)
  const ini = pai ? indice(L, pai.id) + 1 : 0
  const fim = pai ? fimSubarvore(L, indice(L, pai.id)) : L.length
  const blocos: Topico[][] = []
  for (let k = ini; k < fim; ) {
    const e = fimSubarvore(L, k)
    blocos.push(L.slice(k, e))
    k = e
  }
  const de = blocos.findIndex((b) => b[0].id === id)
  if (de < 0 || !Number.isFinite(posicao)) return lista
  const para = Math.max(0, Math.min(blocos.length - 1, Math.round(posicao) - 1))
  if (para === de) return lista
  return [...L.slice(0, ini), ...arrayMove(blocos, de, para).flat(), ...L.slice(fim)]
}

/** Profundidade máxima dentro da subárvore (o próprio item incluso) */
function nivelMaisFundo(lista: Topico[], i: number): number {
  let m: number = lista[i].nivel
  for (let k = i + 1; k < fimSubarvore(lista, i); k++) m = Math.max(m, lista[k].nivel)
  return m
}

/** Pode virar filho do irmão de cima? (precisa ter irmão acima e não passar do 3º nível) */
export function podeRecuar(lista: Topico[], id: string): boolean {
  const L = normalizar(lista)
  const i = indice(L, id)
  return i > 0 && L[i - 1].nivel >= L[i].nivel && nivelMaisFundo(L, i) < NIVEL_MAXIMO
}

/** Vira filho do irmão de cima, levando junto o que está abaixo */
export function recuar(lista: Topico[], id: string): Topico[] {
  if (!podeRecuar(lista, id)) return lista
  const L = normalizar(lista)
  const i = indice(L, id)
  const fim = fimSubarvore(L, i)
  return L.map((t, k) => (k >= i && k < fim ? { ...t, nivel: (t.nivel + 1) as NivelTopico } : t))
}

/** Sobe um nível: sai de dentro do pai e passa a vir logo depois dele */
export function avancar(lista: Topico[], id: string): Topico[] {
  const L = normalizar(lista)
  const i = indice(L, id)
  const pai = paiDe(L, id)
  if (i < 0 || !pai) return lista
  const fim = fimSubarvore(L, i)
  const fatia = L.slice(i, fim).map((t) => ({ ...t, nivel: (t.nivel - 1) as NivelTopico }))
  const resto = [...L.slice(0, i), ...L.slice(fim)]
  const pos = fimSubarvore(resto, indice(resto, pai.id))
  return normalizar([...resto.slice(0, pos), ...fatia, ...resto.slice(pos)])
}

/** Insere um novo item como último filho de `pai` */
export function inserirFilho(lista: Topico[], pai: Topico, novo: Topico): Topico[] {
  const L = normalizar(lista)
  const pos = fimSubarvore(L, indice(L, pai.id))
  return [...L.slice(0, pos), { ...novo, nivel: Math.min(pai.nivel + 1, NIVEL_MAXIMO) as NivelTopico }, ...L.slice(pos)]
}

/** Rótulo para listas de seleção: recuo conforme o nível */
export function rotuloSelecao(t: Topico): string {
  return t.nivel === 0 ? t.nome : `${' '.repeat(t.nivel)}↳ ${t.nome}`
}
