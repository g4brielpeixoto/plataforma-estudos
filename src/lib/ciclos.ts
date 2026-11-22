import type { Ciclo, CicloMeta, Disciplina, Estudo, Topico } from '@/types'

/**
  Ciclos de metas. Cada disciplina é dividida em metas: grupos de assuntos seguidos do edital
  (`topicos.meta_id`). Assunto = tópico sem subtópicos; o tópico que tem subtópicos é só o título da
  seção e não entra em meta (o check dele não conta). O ciclo é a sequência de
  disciplinas que se revezam (a mesma pode aparecer mais de uma vez); a "meta da vez" é a primeira
  meta não cumprida da disciplina na posição atual. Meta cumprida = todos os tópicos dela concluídos.
*/

export interface SituacaoMeta {
  meta: CicloMeta
  /** 1, 2, 3… dentro da disciplina */
  numero: number
  topicos: Topico[]
  concluidos: number
  cumprida: boolean
}

/** Metas de cada disciplina em ordem, com os tópicos (na ordem do edital) e se já foram cumpridas */
export function situacaoDasMetas(metas: CicloMeta[], topicos: Topico[]): Map<string, SituacaoMeta> {
  const porMeta = new Map<string, Topico[]>()
  for (const [t, metaId] of metaEfetiva(topicos)) {
    if (!metaId) continue
    const l = porMeta.get(metaId)
    if (l) l.push(t)
    else porMeta.set(metaId, [t])
  }
  const r = new Map<string, SituacaoMeta>()
  const porDisciplina = metasPorDisciplina(metas)
  for (const lista of porDisciplina.values()) {
    lista.forEach((meta, i) => {
      const ts = (porMeta.get(meta.id) ?? []).slice().sort((a, b) => a.ordem - b.ordem)
      const concluidos = ts.filter((t) => t.concluido).length
      r.set(meta.id, { meta, numero: i + 1, topicos: ts, concluidos, cumprida: ts.length > 0 && concluidos === ts.length })
    })
  }
  return r
}

/** Tópicos de uma lista ordenada de uma disciplina que têm subtópicos (viram título de seção) */
export function temFilhos(lista: Topico[], i: number): boolean {
  return i + 1 < lista.length && lista[i + 1].nivel > lista[i].nivel
}

function ordenarPorDisciplina(topicos: Topico[]): Topico[][] {
  const porDisciplina = new Map<string, Topico[]>()
  for (const t of topicos) {
    const l = porDisciplina.get(t.disciplina_id)
    if (l) l.push(t)
    else porDisciplina.set(t.disciplina_id, [t])
  }
  const r = [...porDisciplina.values()]
  for (const l of r) l.sort((a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em))
  return r
}

/**
  A meta de cada assunto: a dele; sem meta própria (ex.: subtópico criado depois), herda a do tópico de cima.
  Tópico com subtópicos fica sem meta (é título de seção).
*/
export function metaEfetiva(topicos: Topico[]): Map<Topico, string | null> {
  const r = new Map<Topico, string | null>()
  for (const lista of ordenarPorDisciplina(topicos)) {
    const acima: (string | null)[] = [] // meta de cada nível acima (o tópico pai de cada nível)
    lista.forEach((t, i) => {
      acima.length = t.nivel
      const herdada = [...acima].reverse().find((m) => m) ?? null
      if (temFilhos(lista, i)) {
        acima[t.nivel] = t.meta_id ?? herdada
        r.set(t, null)
      } else {
        acima[t.nivel] = null
        r.set(t, t.meta_id ?? herdada)
      }
    })
  }
  return r
}

export function metasPorDisciplina(metas: CicloMeta[]): Map<string, CicloMeta[]> {
  const m = new Map<string, CicloMeta[]>()
  for (const meta of metas) {
    const l = m.get(meta.disciplina_id)
    if (l) l.push(meta)
    else m.set(meta.disciplina_id, [meta])
  }
  for (const l of m.values()) l.sort((a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em))
  return m
}

/** Primeira meta ainda não cumprida da disciplina */
export function proximaMetaDaDisciplina(disciplinaId: string, metas: CicloMeta[], situacao: Map<string, SituacaoMeta>): SituacaoMeta | undefined {
  return (metasPorDisciplina(metas).get(disciplinaId) ?? []).map((m) => situacao.get(m.id)!).find((s) => s && !s.cumprida)
}

export interface EstadoCiclo {
  posicao: number
  metaId: string | null
  /** o que está gravado precisa mudar para isto */
  mudou: boolean
  /** nenhuma disciplina do ciclo tem meta pendente */
  terminou: boolean
}

/**
  Onde o ciclo está de verdade. Se a meta da vez foi cumprida, passa para a próxima posição que ainda tem meta
  pendente; se não há meta da vez (ciclo novo, meta apagada ou de outra disciplina), procura a partir da posição atual.
  `pular` força a passagem para a próxima posição mesmo sem cumprir a meta.
*/
export function resolverCiclo(ciclo: Pick<Ciclo, 'sequencia' | 'posicao' | 'meta_id'>, metas: CicloMeta[], situacao: Map<string, SituacaoMeta>, pular = false): EstadoCiclo {
  const seq = ciclo.sequencia
  if (!seq.length) return { posicao: 0, metaId: null, mudou: ciclo.posicao !== 0 || ciclo.meta_id !== null, terminou: false }
  const pos = ciclo.posicao % seq.length
  const atual = ciclo.meta_id ? situacao.get(ciclo.meta_id) : undefined
  const valida = !!atual && atual.meta.disciplina_id === seq[pos]
  if (valida && !atual.cumprida && !pular) return { posicao: pos, metaId: atual.meta.id, mudou: pos !== ciclo.posicao, terminou: false }
  const inicio = valida || pular ? pos + 1 : pos
  for (let k = 0; k < seq.length; k++) {
    const p = (inicio + k) % seq.length
    const prox = proximaMetaDaDisciplina(seq[p], metas, situacao)
    if (prox) return { posicao: p, metaId: prox.meta.id, mudou: p !== ciclo.posicao || prox.meta.id !== ciclo.meta_id, terminou: false }
  }
  return { posicao: pos, metaId: null, mudou: pos !== ciclo.posicao || ciclo.meta_id !== null, terminou: true }
}

/** Primeiro tópico pendente da meta (ou o primeiro, se todos estão concluídos) — onde o "Começar" leva */
export function topicoParaComecar(s: SituacaoMeta): Topico | undefined {
  return s.topicos.find((t) => !t.concluido) ?? s.topicos[0]
}

/** Questões feitas e acertadas nos tópicos da meta (contando estudos antigos também) */
export function questoesDaMeta(s: SituacaoMeta, estudos: Estudo[]) {
  const ids = new Set(s.topicos.map((t) => t.id))
  let feitas = 0
  let acertadas = 0
  let segundos = 0
  for (const e of estudos) {
    if (!e.topico_id || !ids.has(e.topico_id)) continue
    feitas += e.questoes_feitas ?? 0
    acertadas += e.questoes_acertadas ?? 0
    segundos += e.duracao_segundos ?? 0
  }
  return { feitas, acertadas, segundos }
}

// ---------- dividir uma disciplina em metas ----------

export interface Segmento {
  /** assuntos (tópicos sem subtópicos) que formam a meta, na ordem do edital */
  assuntos: Topico[]
  /** meta que já existe (mantém nome, orientações e o id) ou null para criar */
  metaId: string | null
  nome: string
}

/** Assuntos da disciplina (tópicos sem subtópicos), na ordem do edital; `lista` = tópicos da disciplina já ordenados */
export function assuntosDaDisciplina(lista: Topico[]): Topico[] {
  return lista.filter((_, i) => !temFilhos(lista, i))
}

/** Onde começa cada meta hoje: um assunto começa meta nova quando a meta dele é diferente da do anterior */
export function iniciosAtuais(lista: Topico[]): Set<string> {
  const efetiva = metaEfetiva(lista)
  const assuntos = assuntosDaDisciplina(lista)
  const s = new Set<string>()
  assuntos.forEach((t, i) => {
    if (i === 0 || efetiva.get(t) !== efetiva.get(assuntos[i - 1])) s.add(t.id)
  })
  return s
}

/**
  Monta as metas a partir dos pontos de início escolhidos. Um trecho continua com a meta que o primeiro
  assunto dele já tinha (mantém nome, orientações e id); trecho novo vira meta nova. As que sobrarem são apagadas.
*/
export function segmentar(lista: Topico[], inicios: Set<string>, metasExistentes: CicloMeta[]): Segmento[] {
  const efetiva = metaEfetiva(lista)
  const segs: Topico[][] = []
  assuntosDaDisciplina(lista).forEach((t, i) => {
    if (i === 0 || inicios.has(t.id)) segs.push([t])
    else segs[segs.length - 1].push(t)
  })
  const usadas = new Set<string>()
  return segs.map((assuntos) => {
    const id = efetiva.get(assuntos[0]) ?? null
    const existente = id && !usadas.has(id) ? metasExistentes.find((m) => m.id === id) : undefined
    if (existente) usadas.add(existente.id)
    return { assuntos, metaId: existente?.id ?? null, nome: existente?.nome ?? nomeSugerido(lista, assuntos) }
  })
}

/** Uma meta por tópico principal: corta no primeiro assunto de cada tópico de nível 0 */
export function iniciosPorPrincipal(lista: Topico[]): Set<string> {
  const s = new Set<string>()
  let novo = true
  lista.forEach((t, i) => {
    if (t.nivel === 0) novo = true
    if (novo && !temFilhos(lista, i)) {
      s.add(t.id)
      novo = false
    }
  })
  return s
}

/** Divide em grupos de N assuntos seguidos */
export function iniciosDeNEmN(lista: Topico[], n: number): Set<string> {
  const passo = Math.max(1, Math.floor(n))
  return new Set(
    assuntosDaDisciplina(lista)
      .filter((_, i) => i % passo === 0)
      .map((t) => t.id),
  )
}

/**
  Nome sugerido de uma meta: se ela tem todos os assuntos de um tópico principal, o nome dele;
  senão, o primeiro assunto, e "e mais N" quando tem outros.
*/
export function nomeSugerido(lista: Topico[], assuntos: Topico[]): string {
  const raizDe = new Map<string, Topico>()
  let raiz: Topico | undefined
  for (const t of lista) {
    if (t.nivel === 0) raiz = t
    if (raiz) raizDe.set(t.id, raiz)
  }
  const r = assuntos[0] && raizDe.get(assuntos[0].id)
  if (r && assuntos.every((t) => raizDe.get(t.id) === r)) {
    const todos = assuntosDaDisciplina(lista).filter((t) => raizDe.get(t.id) === r)
    if (todos.length === assuntos.length) return cortar(r.nome.trim())
  }
  const primeiro = assuntos[0]?.nome.trim() ?? 'Meta'
  return cortar(assuntos.length > 1 ? `${primeiro} e mais ${assuntos.length - 1}` : primeiro)
}

const cortar = (nome: string) => (nome.length > 200 ? nome.slice(0, 199) + '…' : nome)

// ---------- siglas e ordem ----------

const PALAVRAS_FORA = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'com', 'para', 'nocoes', 'nocao'])
const SIGLAS_CONHECIDAS: [RegExp, string][] = [
  [/^lingua portuguesa|^portugues/, 'PORT'],
  [/^raciocinio logico|^matematica/, 'RLM'],
  [/^informatica|^nocoes de informatica/, 'INFO'],
  [/^direito civil$/, 'CIV'],
  [/^direito do trabalho$/, 'DT'],
  [/legislacao/, 'LEG'],
  [/^discursiva/, 'DISC'],
]

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Sigla curta para o quadro e a roda ("Direito Constitucional" → DC; "Informática" → INFO) */
export function sugerirSigla(nome: string): string {
  const n = semAcento(nome)
  for (const [re, sigla] of SIGLAS_CONHECIDAS) if (re.test(n)) return sigla
  const palavras = n.split(/[^a-z0-9]+/).filter((p) => p && !PALAVRAS_FORA.has(p))
  if (palavras.length === 0) return nome.slice(0, 4).toUpperCase()
  if (palavras.length === 1) return palavras[0].slice(0, 4).toUpperCase()
  return palavras
    .map((p) => p[0])
    .join('')
    .slice(0, 5)
    .toUpperCase()
}

export function siglaDe(d: Pick<Disciplina, 'nome' | 'sigla'>): string {
  return d.sigla?.trim() || sugerirSigla(d.nome)
}

/**
  Ordem sugerida pelo peso: quem tem peso 2 aparece duas vezes, espaçado em metade do ciclo,
  e as de peso 1 preenchem os espaços entre elas.
*/
export function sequenciaPorPeso(itens: { id: string; peso: number }[]): string[] {
  const pesadas = itens.filter((i) => i.peso >= 2)
  const leves = itens.filter((i) => i.peso < 2)
  const metadeLeves = Math.ceil(leves.length / 2)
  const blocos = [leves.slice(0, metadeLeves), leves.slice(metadeLeves)]
  const r: string[] = []
  for (const bloco of blocos) {
    // intercala as pesadas com as leves do bloco, espalhando as leves
    const total = pesadas.length + bloco.length
    let l = 0
    let p = 0
    for (let i = 0; i < total; i++) {
      const querLeve = bloco.length > 0 && l < bloco.length && Math.floor(((i + 1) * bloco.length) / total) > l
      if (querLeve || p >= pesadas.length) r.push(bloco[l++].id)
      else r.push(pesadas[p++].id)
    }
  }
  return r
}
