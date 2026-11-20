import type { Incidencia, LeiLinha } from '@/types'
import { limparLinha } from './importacao'

/*
  Leis: cada lei é uma lista única de linhas, na ordem, com um nível (0 = artigo/linha solta, 1 = dentro da de cima…).
  Cada linha pertence à linha mais próxima acima dela com um nível a menos; a "subárvore" é a linha mais as seguintes de nível maior.
  Uma linha com incidência conta como "artigo mapeado" e ganha o check de revisado.
  Uma linha vira flashcard quando tem "pergunta >> resposta" ou uma omissão {{c1::…}}.
*/

export const NIVEL_MAXIMO_LEI = 4
export const INCIDENCIAS: Incidencia[] = ['alta', 'media', 'baixa']
export const ROTULO_INCIDENCIA: Record<Incidencia, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

type Item = Pick<LeiLinha, 'id' | 'nivel'>

/** Garante uma árvore válida: começa no nível 0 e nunca desce mais de um nível de uma vez */
export function normalizarLinhas<T extends Item>(lista: T[]): T[] {
  let anterior = -1
  return lista.map((l) => {
    const nivel = Math.max(0, Math.min(l.nivel, anterior + 1, NIVEL_MAXIMO_LEI))
    anterior = nivel
    return nivel === l.nivel ? l : { ...l, nivel }
  })
}

/** Índice (exclusivo) onde termina a subárvore que começa em i */
export function fimDaSubarvore(lista: Item[], i: number): number {
  let j = i + 1
  while (j < lista.length && lista[j].nivel > lista[i].nivel) j++
  return j
}

const indiceDe = (lista: Item[], id: string) => lista.findIndex((l) => l.id === id)

export function descendentes<T extends Item>(lista: T[], id: string): T[] {
  const i = indiceDe(lista, id)
  return i < 0 ? [] : lista.slice(i + 1, fimDaSubarvore(lista, i))
}

export const temFilhos = (lista: Item[], i: number) => i + 1 < lista.length && lista[i + 1].nivel > lista[i].nivel

/** Pai, avô… de uma linha, do mais distante ao mais próximo */
export function ancestrais<T extends Item>(lista: T[], id: string): T[] {
  const acima: T[] = []
  let i = indiceDe(lista, id)
  if (i < 0) return acima
  let nivel = lista[i].nivel
  for (i--; i >= 0 && nivel > 0; i--) {
    if (lista[i].nivel < nivel) {
      acima.unshift(lista[i])
      nivel = lista[i].nivel
    }
  }
  return acima
}

/** Nova linha logo depois de `id`: irmã dela ou, se ela tem linhas dentro, a primeira de dentro. Sem `id`, vai para o fim */
export function inserirDepois<T extends Item>(lista: T[], id: string | null, nova: T): T[] {
  const i = id ? indiceDe(lista, id) : -1
  if (i < 0) return [...lista, { ...nova, nivel: 0 }]
  const nivel = temFilhos(lista, i) ? Math.min(lista[i].nivel + 1, NIVEL_MAXIMO_LEI) : lista[i].nivel
  return [...lista.slice(0, i + 1), { ...nova, nivel }, ...lista.slice(i + 1)]
}

/** Entra na linha de cima (Tab), levando junto o que está dentro */
export function recuarLinha<T extends Item>(lista: T[], id: string): T[] {
  const i = indiceDe(lista, id)
  if (i <= 0 || lista[i - 1].nivel < lista[i].nivel) return lista
  const fim = fimDaSubarvore(lista, i)
  if (Math.max(...lista.slice(i, fim).map((l) => l.nivel)) >= NIVEL_MAXIMO_LEI) return lista
  return lista.map((l, k) => (k >= i && k < fim ? { ...l, nivel: l.nivel + 1 } : l))
}

/** Sai de dentro da linha de cima (Shift+Tab); as irmãs que vinham depois passam a ficar dentro dela */
export function avancarLinha<T extends Item>(lista: T[], id: string): T[] {
  const i = indiceDe(lista, id)
  if (i < 0 || lista[i].nivel === 0) return lista
  const fim = fimDaSubarvore(lista, i)
  return lista.map((l, k) => (k >= i && k < fim ? { ...l, nivel: l.nivel - 1 } : l))
}

/** Troca a linha (com o que está dentro) de lugar com a irmã de cima ou de baixo */
export function moverLinha<T extends Item>(lista: T[], id: string, direcao: -1 | 1): T[] {
  const i = indiceDe(lista, id)
  if (i < 0) return lista
  const fim = fimDaSubarvore(lista, i)
  if (direcao === 1) {
    if (fim >= lista.length || lista[fim].nivel !== lista[i].nivel) return lista
    const fimIrma = fimDaSubarvore(lista, fim)
    return [...lista.slice(0, i), ...lista.slice(fim, fimIrma), ...lista.slice(i, fim), ...lista.slice(fimIrma)]
  }
  let k = i - 1
  while (k >= 0 && lista[k].nivel > lista[i].nivel) k--
  if (k < 0 || lista[k].nivel !== lista[i].nivel) return lista
  return [...lista.slice(0, k), ...lista.slice(i, fim), ...lista.slice(k, i), ...lista.slice(fim)]
}

/** Tira a linha e o que está dentro dela */
export function removerLinha<T extends Item>(lista: T[], id: string): T[] {
  const i = indiceDe(lista, id)
  return i < 0 ? lista : normalizarLinhas([...lista.slice(0, i), ...lista.slice(fimDaSubarvore(lista, i))])
}

/** Tira só a linha; o que estava dentro sobe um nível */
export function removerSoALinha<T extends Item>(lista: T[], id: string): T[] {
  const i = indiceDe(lista, id)
  if (i < 0) return lista
  const fim = fimDaSubarvore(lista, i)
  return normalizarLinhas([...lista.slice(0, i), ...lista.slice(i + 1, fim).map((l) => ({ ...l, nivel: l.nivel - 1 })), ...lista.slice(fim)])
}

// ---------- incidência, filtro e contagem ----------

export type FiltroLei = 'tudo' | 'alta' | 'alta-media' | 'pendentes'

const passa = (l: Pick<LeiLinha, 'incidencia' | 'revisado_em'>, filtro: FiltroLei) =>
  filtro === 'alta' ? l.incidencia === 'alta' : filtro === 'alta-media' ? l.incidencia === 'alta' || l.incidencia === 'media' : !!l.incidencia && !l.revisado_em

/** Linhas que aparecem no filtro: as que passam, com tudo o que está dentro delas */
export function linhasDoFiltro<T extends Item & Pick<LeiLinha, 'incidencia' | 'revisado_em'>>(lista: T[], filtro: FiltroLei): T[] {
  if (filtro === 'tudo') return lista
  const fora: T[] = []
  for (let i = 0; i < lista.length; ) {
    if (passa(lista[i], filtro)) {
      const fim = fimDaSubarvore(lista, i)
      fora.push(...lista.slice(i, fim))
      i = fim
    } else i++
  }
  return fora
}

/** Incidência que vale para a linha: a dela ou a da linha mais próxima acima (o artigo a que ela pertence) */
export function incidenciaEfetiva(lista: (Item & Pick<LeiLinha, 'incidencia'>)[], id: string): Incidencia | null {
  const propria = lista.find((l) => l.id === id)?.incidencia
  if (propria) return propria
  const acima = ancestrais(lista, id)
  for (let k = acima.length - 1; k >= 0; k--) if (acima[k].incidencia) return acima[k].incidencia
  return null
}

export interface ResumoLei {
  mapeados: number
  revisados: number
  porIncidencia: Record<Incidencia, number>
  cartoes: number
}

export function resumirLei(linhas: Pick<LeiLinha, 'incidencia' | 'revisado_em' | 'nota_id'>[]): ResumoLei {
  const r: ResumoLei = { mapeados: 0, revisados: 0, porIncidencia: { alta: 0, media: 0, baixa: 0 }, cartoes: 0 }
  for (const l of linhas) {
    if (l.nota_id) r.cartoes++
    if (!l.incidencia) continue
    r.mapeados++
    r.porIncidencia[l.incidencia]++
    if (l.revisado_em) r.revisados++
  }
  return r
}

// ---------- flashcard a partir da linha ----------

const RE_OMISSAO = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g
const SEPARADOR = '&gt;&gt;'
const SEM_FECHAMENTO = new Set(['br', 'img', 'hr'])

export type CartaoDaLinha = { tipo: 'basico'; frente: string; verso: string } | { tipo: 'omissao'; frente: string; verso: '' }

const semTags = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

/**
 * O flashcard escrito na linha, ou null:
 * - omissão: a linha tem {{c1::…}} (o texto inteiro é o cartão);
 * - frente e verso: "pergunta >> resposta" (o HTML é cortado no >>, fechando e reabrindo as tags do meio).
 */
export function cartaoDaLinha(html: string): CartaoDaLinha | null {
  RE_OMISSAO.lastIndex = 0
  if (RE_OMISSAO.test(html)) return { tipo: 'omissao', frente: html, verso: '' }
  // procura o primeiro >> que está no texto (fora de uma tag), guardando as tags abertas até ali
  const abertas: { nome: string; tag: string }[] = []
  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const fim = html.indexOf('>', i)
      if (fim < 0) break
      const tag = html.slice(i, fim + 1)
      const m = tag.match(/^<(\/?)([a-zA-Z0-9]+)/)
      if (m) {
        const nome = m[2].toLowerCase()
        if (m[1]) {
          const k = abertas.map((a) => a.nome).lastIndexOf(nome)
          if (k >= 0) abertas.splice(k, 1)
        } else if (!SEM_FECHAMENTO.has(nome) && !tag.endsWith('/>')) abertas.push({ nome, tag })
      }
      i = fim + 1
      continue
    }
    if (html.startsWith(SEPARADOR, i)) {
      const frente = html.slice(0, i) + [...abertas].reverse().map((a) => `</${a.nome}>`).join('')
      const verso = abertas.map((a) => a.tag).join('') + html.slice(i + SEPARADOR.length)
      if (!semTags(frente) || !semTags(verso)) return null
      return { tipo: 'basico', frente: aparar(frente), verso: aparar(verso) }
    }
    i++
  }
  return null
}

/** tira espaços (inclusive &nbsp;) das pontas do texto, sem mexer nas tags */
const aparar = (html: string) => html.replace(/^((?:<[^>]+>)*)(?:\s|&nbsp;)+/, '$1').replace(/(?:\s|&nbsp;)+((?:<\/[^>]+>)*)$/, '$1')

/** A linha para exibir: as omissões aparecem como o trecho destacado, sem as chaves */
export const linhaParaExibir = (html: string) => html.replace(RE_OMISSAO, (_t, _n, conteudo: string) => `<span class="omissao omissao-resposta">${conteudo}</span>`)

// ---------- importação por lista colada ----------

export interface LinhaImportada {
  texto: string
  nivel: number
  incidencia: Incidencia | null
}

const larguraRecuo = (linha: string) => [...(linha.match(/^[\t ]*/)?.[0] ?? '')].reduce((s, c) => s + (c === '\t' ? 4 : 1), 0)
const RE_MARCA = /\s*[[(]\s*(alta|m[eé]dia|baixa)\s*[\])]\s*$/i

/**
 * Uma linha do texto = uma linha da lei. Recuo maior que o da linha de cima desce um nível.
 * "[alta]", "[média]" ou "[baixa]" no fim marca a incidência.
 */
export function analisarLinhasDeLei(texto: string): LinhaImportada[] {
  const saida: LinhaImportada[] = []
  const pilha: number[] = []
  for (const bruta of texto.split(/\r?\n/)) {
    let linha = limparLinha(bruta)
    if (!linha) continue
    let incidencia: Incidencia | null = null
    const marca = linha.match(RE_MARCA)
    if (marca) {
      const m = marca[1].toLowerCase()
      incidencia = m === 'alta' ? 'alta' : m === 'baixa' ? 'baixa' : 'media'
      linha = linha.slice(0, marca.index).trim()
      if (!linha) continue
    }
    const largura = larguraRecuo(bruta)
    if (!pilha.length) pilha.push(largura)
    else {
      while (pilha.length > 1 && largura < pilha[pilha.length - 1]) pilha.pop()
      if (largura > pilha[pilha.length - 1] + 1 && pilha.length <= NIVEL_MAXIMO_LEI) pilha.push(largura)
    }
    saida.push({ texto: linha, nivel: pilha.length - 1, incidencia })
  }
  return saida
}
