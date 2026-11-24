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
  A meta de cada assunto: a dele; sem meta própria, herda a do tópico de cima (subtópico criado depois).
  Se ainda assim ficar sem meta (assunto novo no meio do edital) e a disciplina já estiver dividida, entra
  na meta do assunto anterior (ou do seguinte, se for o primeiro): assim nenhum assunto fica de fora do
  ciclo e a meta da vez nunca "pula" um assunto que ainda não foi concluído.
  Tópico com subtópicos fica sem meta (é título de seção).
*/
export function metaEfetiva(topicos: Topico[]): Map<Topico, string | null> {
  const r = new Map<Topico, string | null>()
  for (const lista of ordenarPorDisciplina(topicos)) {
    const acima: (string | null)[] = [] // meta de cada nível acima (o tópico pai de cada nível)
    const assuntos: Topico[] = []
    lista.forEach((t, i) => {
      acima.length = t.nivel
      const herdada = [...acima].reverse().find((m) => m) ?? null
      if (temFilhos(lista, i)) {
        acima[t.nivel] = t.meta_id ?? herdada
        r.set(t, null)
      } else {
        acima[t.nivel] = null
        r.set(t, t.meta_id ?? herdada)
        assuntos.push(t)
      }
    })
    // assuntos sem meta numa disciplina já dividida: entram na meta do assunto vizinho
    const primeira = assuntos.map((t) => r.get(t)).find((m) => m)
    if (!primeira) continue
    let anterior: string = primeira
    for (const t of assuntos) {
      const m = r.get(t)
      if (m) anterior = m
      else r.set(t, anterior)
    }
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

// ---------- metas iguais ao edital ----------

/** Assuntos da disciplina (tópicos sem subtópicos), na ordem do edital; `lista` = tópicos da disciplina já ordenados */
export function assuntosDaDisciplina(lista: Topico[]): Topico[] {
  return lista.filter((_, i) => !temFilhos(lista, i))
}

/** Tópicos principais da disciplina (nível 0), cada um com os assuntos dele, na ordem do edital */
export function principaisComAssuntos(lista: Topico[]): { principal: Topico; assuntos: Topico[] }[] {
  const r: { principal: Topico; assuntos: Topico[] }[] = []
  lista.forEach((t, i) => {
    if (t.nivel === 0 || r.length === 0) r.push({ principal: t, assuntos: [] })
    if (!temFilhos(lista, i)) r[r.length - 1].assuntos.push(t)
  })
  return r.filter((g) => g.assuntos.length > 0)
}

export interface PlanoMetas {
  /** metas a criar ou atualizar (nome = tópico principal, ordem = posição no edital) */
  salvar: { id: string; disciplina_id: string; ordem: number; nome: string }[]
  /** assuntos que precisam apontar para outra meta */
  ligar: { metaId: string; topicoIds: string[] }[]
  /** títulos de seção que estão com meta (não deveriam) */
  soltar: string[]
  /** metas que não correspondem a nenhum tópico principal e não têm orientações */
  apagar: string[]
}

/**
  As metas seguem o edital sozinhas: uma meta por tópico principal, com o nome dele, na ordem do edital,
  e todos os assuntos dele dentro. Cada tópico principal fica com a meta que a maioria dos assuntos dele
  já usa (assim as orientações e a meta da vez continuam); se nenhuma serve, ganha meta nova.
  Meta que sobra sem orientações é apagada; com orientações fica guardada (sem aparecer).
  Devolve null quando já está tudo certo.
*/
export function planoDeMetas(topicos: Topico[], metas: CicloMeta[], novoId: () => string = () => crypto.randomUUID()): PlanoMetas | null {
  const plano: PlanoMetas = { salvar: [], ligar: [], soltar: [], apagar: [] }
  const metasDe = metasPorDisciplina(metas)
  const usadas = new Set<string>()
  for (const lista of ordenarPorDisciplina(topicos)) {
    const disciplinaId = lista[0].disciplina_id
    const daDisciplina = new Map((metasDe.get(disciplinaId) ?? []).map((m) => [m.id, m]))
    lista.forEach((t, i) => {
      if (temFilhos(lista, i) && t.meta_id) plano.soltar.push(t.id)
    })
    principaisComAssuntos(lista).forEach(({ principal, assuntos }, ordem) => {
      const contagem = new Map<string, number>()
      for (const t of assuntos) if (t.meta_id && daDisciplina.has(t.meta_id) && !usadas.has(t.meta_id)) contagem.set(t.meta_id, (contagem.get(t.meta_id) ?? 0) + 1)
      const escolhida = [...contagem].sort((a, b) => b[1] - a[1])[0]?.[0]
      const id = escolhida ?? novoId()
      usadas.add(id)
      const nome = cortar(principal.nome.trim()) || `Meta ${ordem + 1}`
      const atual = daDisciplina.get(id)
      if (!atual || atual.nome !== nome || atual.ordem !== ordem) plano.salvar.push({ id, disciplina_id: disciplinaId, ordem, nome })
      const fora = assuntos.filter((t) => t.meta_id !== id).map((t) => t.id)
      if (fora.length) plano.ligar.push({ metaId: id, topicoIds: fora })
    })
  }
  for (const m of metas) if (!usadas.has(m.id) && !m.orientacoes?.trim()) plano.apagar.push(m.id)
  const vazio = !plano.salvar.length && !plano.ligar.length && !plano.soltar.length && !plano.apagar.length
  return vazio ? null : plano
}

/** Só as metas que têm assuntos, na ordem do edital (a meta guardada sem assunto não aparece) */
export function metasNaOrdemDoEdital(metas: CicloMeta[], topicos: Topico[]): CicloMeta[] {
  const posicao = new Map<string, number>()
  let k = 0
  for (const lista of ordenarPorDisciplina(topicos)) {
    const efetiva = metaEfetiva(lista)
    for (const t of assuntosDaDisciplina(lista)) {
      const m = efetiva.get(t)
      if (m && !posicao.has(m)) posicao.set(m, k++)
    }
  }
  return metas
    .filter((m) => posicao.has(m.id))
    .sort((a, b) => posicao.get(a.id)! - posicao.get(b.id)!)
    .map((m) => ({ ...m, ordem: posicao.get(m.id)! }))
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
