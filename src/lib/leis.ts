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
/** cor da bolinha de cada incidência (tokens do tema) */
export const COR_INCIDENCIA: Record<Incidencia, string> = { alta: 'var(--c-ruim)', media: 'var(--c-medio)', baixa: 'var(--c-revisao)' }
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

/** Linhas que aparecem no filtro: as que passam, com o que está dentro delas e, num artigo, os parágrafos e incisos escritos logo depois */
export function linhasDoFiltro<T extends Item & Pick<LeiLinha, 'incidencia' | 'revisado_em'> & { texto?: string }>(lista: T[], filtro: FiltroLei): T[] {
  if (filtro === 'tudo') return lista
  const comTexto = lista.map((l) => ({ id: l.id, nivel: l.nivel, texto: l.texto ?? '' }))
  const fora: T[] = []
  for (let i = 0; i < lista.length; ) {
    if (passa(lista[i], filtro)) {
      const fim = fimDoArtigo(comTexto, i)
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

// ---------- sumário ----------

const RE_ARTIGO = /^(arts?\.?\s*\d+[\dºª°.\-A-Za-z]*(?:\s+(?:a|e|ao)\s+\d+[\dºª°.\-A-Za-z]*)?)/i

/** Nome curto da linha no sumário: "Art. 11-A" quando começa com o artigo; senão, o começo do texto */
export function rotuloSumario(texto: string): string {
  const t = texto.trim()
  const m = t.match(RE_ARTIGO)
  if (m) return m[1].replace(/[.-]+$/, '')
  return t.length > 44 ? `${t.slice(0, 42).trimEnd()}…` : t
}

export interface EntradaSumario {
  id: string
  nivel: number
  /** linha do topo sem incidência que tem artigos mapeados dentro (título, capítulo) */
  divisao: boolean
}

/** O que entra no sumário: as linhas do topo e toda linha com incidência (artigo mapeado) */
export function entradasDoSumario(lista: (Item & Pick<LeiLinha, 'incidencia'>)[]): EntradaSumario[] {
  const saida: EntradaSumario[] = []
  lista.forEach((l, i) => {
    if (l.nivel !== 0 && !l.incidencia) return
    const divisao = !l.incidencia && lista.slice(i + 1, fimDaSubarvore(lista, i)).some((d) => d.incidencia)
    saida.push({ id: l.id, nivel: Math.min(l.nivel, 2), divisao })
  })
  return saida
}

// ---------- ordem dos artigos ----------

const RE_NUMERO_ARTIGO = /^arts?\.?\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:º|°|ª|o\b)?/i
// letra do artigo colada no número por hífen (11-A, 384-AB); "Art. 391 - Não…" não tem letra
const RE_LETRA_ARTIGO = /^-([A-Z]{1,2})(?![A-Za-zÀ-ÿ])/

/** Número do artigo com que a linha começa, pronto para comparar ("Art. 11-A" fica entre o 11 e o 12); null se não começa com artigo */
export function numeroDoArtigo(texto: string): number | null {
  const t = texto.trim()
  const m = t.match(RE_NUMERO_ARTIGO)
  if (!m) return null
  const n = Number(m[1].replace(/\./g, ''))
  if (!Number.isFinite(n)) return null
  const letras = t.slice(m[0].length).match(RE_LETRA_ARTIGO)?.[1] ?? ''
  let fracao = 0
  for (let k = 0; k < letras.length; k++) fracao += (letras.charCodeAt(k) - 64) / 27 ** (k + 1)
  return n + fracao
}

type ItemComTexto = Item & { texto: string }
const semHtml = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
const numeroDaLinha = (l: ItemComTexto) => numeroDoArtigo(semHtml(l.texto))

const RE_DIVISORIA = /^(t[ií]tulo|cap[ií]tulo|se[cç][aã]o|subse[cç][aã]o|livro|parte)\b/i
/** Título, capítulo, seção…: separa os trechos de artigos e não pertence a nenhum artigo */
export const ehDivisoria = (texto: string) => RE_DIVISORIA.test(texto.trim())
/** Linha toda em negrito (como os títulos e as epígrafes da lei): também é divisória */
const todaEmNegrito = (html: string) => {
  const t = html.trim()
  if (!t.startsWith('<b>') || !t.endsWith('</b>')) return false
  return !/<\/?b>/.test(t.slice(3, -4).replace(/<\/b>\s*<b>/g, ''))
}
const linhaDivisoria = (l: ItemComTexto) => ehDivisoria(semHtml(l.texto)) || (todaEmNegrito(l.texto) && numeroDaLinha(l) === null)

interface Grupo {
  ini: number
  /** fim da linha com o que está dentro dela */
  fimProprio: number
  /** fim contando os parágrafos, incisos e anotações escritos logo depois do artigo, no mesmo nível */
  fim: number
  numero: number | null
}

/**
 * As linhas de mesmo pai entre [ini, fim), em grupos: um artigo leva consigo as linhas seguintes do mesmo nível
 * que não são artigo nem divisória (os parágrafos e incisos dele); as outras linhas ficam cada uma no seu grupo.
 */
function gruposIrmaos(lista: ItemComTexto[], ini: number, fim: number): Grupo[] {
  const grupos: Grupo[] = []
  for (let k = ini; k < fim; ) {
    const f = Math.min(fimDaSubarvore(lista, k), fim)
    const numero = numeroDaLinha(lista[k])
    const atual = grupos[grupos.length - 1]
    if (numero === null && atual && atual.numero !== null && !linhaDivisoria(lista[k])) atual.fim = f
    else grupos.push({ ini: k, fimProprio: f, fim: f, numero })
    k = f
  }
  return grupos
}

/** Onde começam e terminam as irmãs da linha i (mesmo pai) */
function faixaDasIrmas(lista: Item[], i: number): [number, number] {
  const nivel = lista[i].nivel
  let ini = i
  while (ini > 0 && lista[ini - 1].nivel >= nivel) ini--
  let fim = i
  while (fim < lista.length && lista[fim].nivel >= nivel) fim++
  return [ini, fim]
}

/** Fim (exclusivo) do artigo que começa em i, contando os parágrafos e incisos escritos logo depois dele no mesmo nível */
export function fimDoArtigo(lista: ItemComTexto[], i: number): number {
  const proprio = fimDaSubarvore(lista, i)
  if (numeroDaLinha(lista[i]) === null) return proprio
  const [, fim] = faixaDasIrmas(lista, i)
  return gruposIrmaos(lista, i, fim)[0]?.fim ?? proprio
}

/**
 * Põe o artigo no lugar dele entre os artigos vizinhos, com o que está dentro dele.
 * Só mexe se a linha começa com "Art. N" e os outros artigos em volta já estão em ordem;
 * divisórias (título, capítulo) e linhas soltas antes do primeiro artigo não são atravessadas.
 * `comSeguintes`: leva também os parágrafos e incisos escritos logo depois dele no mesmo nível
 * (num artigo recém-escrito no meio de outro não, porque o que vem depois é do artigo de cima).
 */
export function encaixarArtigo<T extends ItemComTexto>(lista: T[], id: string, comSeguintes = false): T[] {
  const i = indiceDe(lista, id)
  if (i < 0) return lista
  const numero = numeroDaLinha(lista[i])
  if (numero === null) return lista
  const meuFim = comSeguintes ? fimDoArtigo(lista, i) : fimDaSubarvore(lista, i)
  const fatia = lista.slice(i, meuFim)
  const resto = [...lista.slice(0, i), ...lista.slice(meuFim)]
  if (!resto.length) return lista
  // sem a linha, as irmãs em volta de onde ela estava
  const nivel = lista[i].nivel
  let ini = i
  while (ini > 0 && resto[ini - 1].nivel >= nivel) ini--
  let fim = i
  while (fim < resto.length && resto[fim].nivel >= nivel) fim++
  if (ini === fim) return lista
  const grupos = gruposIrmaos(resto, ini, fim)
  // o artigo logo acima (a linha estava depois dele ou no meio dos parágrafos dele) ou, senão, o logo abaixo
  let perto = grupos.findIndex((g) => g.numero !== null && g.ini < i && g.fim >= i)
  if (perto < 0) perto = grupos.findIndex((g) => g.numero !== null && g.ini === i)
  if (perto < 0) return lista
  let a = perto
  while (a > 0 && grupos[a - 1].numero !== null) a--
  let z = perto
  while (z < grupos.length - 1 && grupos[z + 1].numero !== null) z++
  const trecho = grupos.slice(a, z + 1)
  if (trecho.some((g, k) => k > 0 && (g.numero as number) < (trecho[k - 1].numero as number))) return lista
  const proximo = trecho.find((g) => (g.numero as number) > numero)
  const onde = proximo ? proximo.ini : trecho[trecho.length - 1].fim
  if (onde === i) return lista
  return [...resto.slice(0, onde), ...fatia, ...resto.slice(onde)]
}

/** Ordena os artigos de toda a lei, em cada nível; cada artigo leva os parágrafos e incisos dele, e as divisórias ficam onde estão */
export function ordenarPorArtigo<T extends ItemComTexto>(lista: T[]): T[] {
  const ordenar = (ini: number, fim: number): T[] => {
    const grupos = gruposIrmaos(lista, ini, fim)
    const linhasDe = (g: Grupo): T[] => {
      const saida: T[] = []
      for (let k = g.ini; k < g.fim; ) {
        const f = fimDaSubarvore(lista, k)
        saida.push(lista[k], ...ordenar(k + 1, Math.min(f, g.fim)))
        k = Math.min(f, g.fim)
      }
      return saida
    }
    const saida: T[] = []
    for (let k = 0; k < grupos.length; ) {
      let j = k
      while (j < grupos.length && grupos[j].numero !== null) j++
      if (j === k) {
        saida.push(...linhasDe(grupos[k]))
        k++
        continue
      }
      const trecho = grupos.slice(k, j).map((g, pos) => ({ g, pos }))
      trecho.sort((x, y) => (x.g.numero as number) - (y.g.numero as number) || x.pos - y.pos)
      for (const t of trecho) saida.push(...linhasDe(t.g))
      k = j
    }
    return saida
  }
  const nova = ordenar(0, lista.length)
  return nova.every((l, k) => l === lista[k]) ? lista : nova
}

// ---------- ligações entre dispositivos (estilo RemNote) ----------

/** Ids dos dispositivos ligados num texto (`<span data-ref="id">`) */
export function refsDoTexto(html: string): string[] {
  return [...html.matchAll(/data-ref="([0-9a-f-]{36})"/gi)].map((m) => m[1].toLowerCase())
}

const semTagsNem = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** Nome curto de um dispositivo: "Art. 482", "§ 2º", "Parágrafo único", "inciso IV", "alínea b"; null se a linha não começa com um */
export function rotuloDispositivo(texto: string): string | null {
  const t = semTagsNem(texto).replace(/^[“"]\s*/, '')
  if (/^arts?\.?\s*\d/i.test(t)) return rotuloSumario(t)
  let m = t.match(/^§\s*(\d+)\s*([º°o])?(?:-([A-Z]))?/)
  if (m) return `§ ${m[1]}${m[2] || Number(m[1]) < 10 ? 'º' : ''}${m[3] ? `-${m[3]}` : ''}`
  if (/^par[áa]grafo [úu]nico/i.test(t)) return 'Parágrafo único'
  m = t.match(/^([IVXLC]+(?:-[A-Z])?)\s*[-–]/)
  if (m) return `inciso ${m[1]}`
  m = t.match(/^([a-z])\)/)
  if (m) return `alínea ${m[1]}`
  return null
}

/** Os dispositivos acima da linha (artigo, §, inciso) e ela mesma, do mais geral ao mais específico */
function cadeia<T extends ItemComTexto>(lista: T[], i: number): T[] {
  const acima = ancestrais(lista, lista[i].id)
  const topo = acima[0] ?? lista[i]
  const iTopo = indiceDe(lista, topo.id)
  // parágrafo escrito sem Tab depois do artigo: o artigo é o "dono" dele
  if (numeroDaLinha(topo) === null && !linhaDivisoria(topo) && topo.nivel === 0) {
    for (let k = iTopo - 1; k >= 0; k--) {
      const l = lista[k]
      if (l.nivel !== topo.nivel) continue
      if (linhaDivisoria(l)) break
      if (numeroDaLinha(l) !== null) return [l, ...acima, lista[i]]
    }
  }
  return [...acima, lista[i]]
}

/** Caminho do dispositivo, para a etiqueta da ligação: "Art. 482, § 2º, inciso IV" (ou o começo do texto) */
export function caminhoDoDispositivo(lista: ItemComTexto[], id: string): string {
  const i = indiceDe(lista, id)
  if (i < 0) return ''
  const partes = cadeia(lista, i)
    .map((l) => rotuloDispositivo(l.texto))
    .filter((x): x is string => !!x)
  if (partes.length && rotuloDispositivo(lista[i].texto)) return partes.join(', ')
  const t = semTagsNem(lista[i].texto)
  const curto = t.length > 40 ? `${t.slice(0, 38).trimEnd()}…` : t
  return partes.length ? `${partes.join(', ')} › ${curto}` : curto
}

const chaveBusca = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°ª]/g, '')
    .replace(/(\d)\.(?=\d)/g, '$1')
    .replace(/§/g, ' § ')
    .replace(/[.,;:()“”"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export interface ItemBusca {
  id: string
  leiId: string
  rotulo: string
  /** texto da linha sem formatação */
  texto: string
  chave: string
}

/** Índice para procurar dispositivos em todas as leis (nome da lei + caminho + texto) */
export function indiceDeBusca(leis: { id: string; nome: string }[], linhasPorLei: Map<string, ItemComTexto[]>): ItemBusca[] {
  const itens: ItemBusca[] = []
  for (const lei of leis) {
    const lista = linhasPorLei.get(lei.id) ?? []
    lista.forEach((l) => {
      if (linhaDivisoria(l)) return
      const caminho = caminhoDoDispositivo(lista, l.id)
      const texto = semTagsNem(l.texto)
      if (!texto) return
      const rotulo = `${lei.nome} › ${caminho}`
      itens.push({ id: l.id, leiId: lei.id, rotulo, texto, chave: chaveBusca(`${rotulo} ${texto}`) })
    })
  }
  return itens
}

/**
 * Procura dispositivos: cada palavra precisa aparecer; número de artigo vale inteiro ("482" acha o art. 482, não o 1.482).
 * Os que batem no rótulo (lei e caminho) vêm antes dos que só batem no texto.
 */
export function buscarDispositivos(indice: ItemBusca[], consulta: string, limite = 30): ItemBusca[] {
  const palavras = chaveBusca(consulta).split(' ').filter(Boolean)
  if (!palavras.length) return []
  const bate = (alvo: string, p: string) => (/^\d+$/.test(p) ? new RegExp(`(^|\\D)${p}(?!\\d)`).test(alvo) : alvo.includes(p))
  const achados: { item: ItemBusca; peso: number }[] = []
  for (const item of indice) {
    if (!palavras.every((p) => bate(item.chave, p))) continue
    const rot = chaveBusca(item.rotulo)
    const peso = palavras.filter((p) => bate(rot, p)).length
    achados.push({ item, peso })
  }
  return achados
    .sort((a, b) => b.peso - a.peso)
    .slice(0, limite)
    .map((a) => a.item)
}
