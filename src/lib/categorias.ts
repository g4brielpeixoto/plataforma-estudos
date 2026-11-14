import type { Estudo } from '@/types'

/*
  Categoria do estudo: o que foi feito naquele registro (teoria, questões…).
  Não existe tabela de categorias: a lista é a padrão mais as que o usuário já usou em algum estudo.
*/

export const CATEGORIAS_PADRAO = ['Teoria', 'Questões', 'Revisão', 'Flashcards']
export const LIMITE_CATEGORIA = 40

/** Para reconhecer a mesma categoria escrita com maiúsculas, acentos ou espaços diferentes */
export const chaveCategoria = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

/** O nome como fica gravado: sem espaço sobrando e no limite; vazio = null */
export function limparCategoria(nome: string): string | null {
  const limpo = nome.trim().replace(/\s+/g, ' ').slice(0, LIMITE_CATEGORIA).trim()
  return limpo || null
}

/** As padrão, na ordem, e depois as que o usuário criou (em ordem alfabética) */
export function categoriasConhecidas(estudos: Pick<Estudo, 'categoria'>[]): string[] {
  const vistas = new Set(CATEGORIAS_PADRAO.map(chaveCategoria))
  const outras: string[] = []
  for (const e of estudos) {
    const nome = e.categoria ? limparCategoria(e.categoria) : null
    if (!nome || vistas.has(chaveCategoria(nome))) continue
    vistas.add(chaveCategoria(nome))
    outras.push(nome)
  }
  return [...CATEGORIAS_PADRAO, ...outras.sort((a, b) => a.localeCompare(b, 'pt-BR'))]
}

/** Se o nome digitado já existe na lista (com outra grafia), devolve o da lista; senão, o digitado limpo */
export function categoriaDaLista(nome: string, lista: string[]): string | null {
  const limpo = limparCategoria(nome)
  if (!limpo) return null
  return lista.find((c) => chaveCategoria(c) === chaveCategoria(limpo)) ?? limpo
}
