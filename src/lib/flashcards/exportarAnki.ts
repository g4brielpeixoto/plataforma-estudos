import type { Disciplina, FlashCartao, FlashNota, Topico } from '@/types'
import { limparHtml } from './html'

/**
  Exportação para o Anki: monta um pacote .apkg (formato clássico, collection.anki2, esquema 11, que todas as
  versões do Anki importam) no navegador, com sql.js e fflate carregados sob demanda.

  - Baralho: "Disciplina" ou "Disciplina::Tópico".
  - Tipos de nota próprios ("Aprovi · Frente e verso", "Aprovi · Digitar a resposta", "Aprovi · Omissão"),
    com o CSS do marca-texto, das cores, dos tamanhos e do alinhamento, para o cartão ficar igual ao do app.
  - Omissão usa a mesma sintaxe do Anki ({{c1::…}}): cada número vira um cartão.
  - guid: o do Anki quando a nota veio de lá (origem_anki), senão um tirado do id da nota; exportar de novo
    não duplica as notas no Anki.
  - Com o progresso: cartão em revisão (ou reaprendendo) vai como revisão, com o vencimento, o intervalo, as
    repetições e os lapsos; novo e aprendendo vão como novos. Suspenso continua suspenso.
  - Imagens: baixadas do armazenamento e colocadas no pacote (a falha de uma imagem não para a exportação).
*/

export interface DadosExportacao {
  notas: FlashNota[]
  cartoesPorNota: Map<string, FlashCartao[]>
  disciplinas: Disciplina[]
  topicos: Topico[]
  comProgresso: boolean
  /** baixa a imagem; devolve null quando não deu */
  baixarImagem: (url: string) => Promise<Uint8Array | null>
  aoProgredir?: (texto: string) => void
}

export interface ResultadoExportacao {
  arquivo: Uint8Array
  notas: number
  cartoes: number
  imagens: number
  imagensQueFalharam: number
}

const ID_BASICO = 1795400000001
const ID_DIGITAR = 1795400000002
const ID_OMISSAO = 1795400000003

const CSS = `.card {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 20px;
  line-height: 1.5;
  text-align: center;
  color: #2a1f2d;
  background-color: #ffffff;
}
.nightMode.card, .night_mode .card { color: #ece6ee; background-color: #1d171f; }
img { max-width: 100%; height: auto; }
mark { background: #fdf0a0; color: #2a1f2d; padding: 0 0.1em; border-radius: 2px; }
mark.grifo-amarelo { background: #fdf0a0; }
mark.grifo-verde { background: #cdeccb; }
mark.grifo-azul { background: #c7e0f8; }
mark.grifo-rosa { background: #fbd0de; }
mark.grifo-lilas { background: #e2d0f3; }
mark.grifo-laranja { background: #fddbb5; }
.cor-vermelho { color: #b3261e; }
.cor-laranja { color: #a8510a; }
.cor-verde { color: #1e7a46; }
.cor-azul { color: #1f5fbf; }
.cor-roxo { color: #7b3fb5; }
.cor-rosa { color: #b8246c; }
.nightMode .cor-vermelho { color: #ff9289; }
.nightMode .cor-laranja { color: #ffb86b; }
.nightMode .cor-verde { color: #7fd9a0; }
.nightMode .cor-azul { color: #8fbcff; }
.nightMode .cor-roxo { color: #cdaaf7; }
.nightMode .cor-rosa { color: #ff94c4; }
.nightMode mark .cor-vermelho { color: #b3261e; }
.nightMode mark .cor-laranja { color: #a8510a; }
.nightMode mark .cor-verde { color: #1e7a46; }
.nightMode mark .cor-azul { color: #1f5fbf; }
.nightMode mark .cor-roxo { color: #7b3fb5; }
.nightMode mark .cor-rosa { color: #b8246c; }
.tam-grande { font-size: 1.3em; }
.tam-enorme { font-size: 1.7em; }
.alinha-esquerda { text-align: left; }
.alinha-centro { text-align: center; }
.alinha-justificado { text-align: justify; }
.cloze { font-weight: bold; color: #6e4c73; }
.nightMode .cloze { color: #d3bbec; }
`

const LATEX_PRE =
  '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n'
const LATEX_POST = '\\end{document}'

function campo(nome: string, ord: number) {
  return { name: nome, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] }
}

function modelos(agora: number) {
  const base = (id: number, nome: string, tipo: 0 | 1, campos: string[], tmpls: { name: string; qfmt: string; afmt: string }[]) => ({
    id,
    name: nome,
    type: tipo,
    mod: Math.floor(agora / 1000),
    usn: -1,
    sortf: 0,
    did: 1,
    tmpls: tmpls.map((t, ord) => ({ ...t, ord, did: null, bqfmt: '', bafmt: '' })),
    flds: campos.map(campo),
    css: CSS,
    latexPre: LATEX_PRE,
    latexPost: LATEX_POST,
    latexsvg: false,
    req: [[0, 'any', [0]]],
    tags: [],
    vers: [],
  })
  return {
    [ID_BASICO]: base(ID_BASICO, 'Aprovi · Frente e verso', 0, ['Frente', 'Verso'], [
      { name: 'Cartão 1', qfmt: '{{Frente}}', afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Verso}}' },
    ]),
    [ID_DIGITAR]: base(ID_DIGITAR, 'Aprovi · Digitar a resposta', 0, ['Frente', 'Verso'], [
      { name: 'Cartão 1', qfmt: '{{Frente}}\n\n{{type:Verso}}', afmt: '{{Frente}}\n\n<hr id=answer>\n\n{{type:Verso}}' },
    ]),
    [ID_OMISSAO]: base(ID_OMISSAO, 'Aprovi · Omissão', 1, ['Texto', 'Verso extra'], [
      { name: 'Omissão', qfmt: '{{cloze:Texto}}', afmt: '{{cloze:Texto}}<br>\n{{Verso extra}}' },
    ]),
  }
}

const CONFIG_BARALHO = {
  1: {
    id: 1,
    name: 'Default',
    mod: 0,
    usn: 0,
    maxTaken: 60,
    autoplay: true,
    timer: 0,
    replayq: true,
    dyn: false,
    new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
    lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
    rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 200 },
  },
}

function baralho(id: number, nome: string, agora: number) {
  return {
    id,
    name: nome,
    mod: Math.floor(agora / 1000),
    usn: -1,
    lrnToday: [0, 0],
    revToday: [0, 0],
    newToday: [0, 0],
    timeToday: [0, 0],
    collapsed: false,
    browserCollapsed: false,
    desc: '',
    dyn: 0,
    conf: 1,
    extendNew: 0,
    extendRev: 0,
  }
}

/** Nome de baralho sem "::" solto (o Anki usa "::" para separar o baralho de dentro) */
function nomeBaralho(s: string) {
  return s.replace(/::/g, ':').replace(/\s+/g, ' ').trim() || 'Sem nome'
}

/** Texto puro do campo, como o Anki usa no campo de ordenação e no checksum */
export function textoDoCampo(html: string) {
  return html
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function checksum(texto: string) {
  const bytes = new TextEncoder().encode(texto)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))
  return ((hash[0] << 24) >>> 0) + (hash[1] << 16) + (hash[2] << 8) + hash[3]
}

/** guid curto e estável a partir do id da nota (base 36 do uuid) */
export function guidDaNota(n: Pick<FlashNota, 'id' | 'origem_anki'>) {
  if (n.origem_anki) return n.origem_anki
  return 'apv' + BigInt('0x' + n.id.replace(/-/g, '')).toString(36)
}

/** Endereços das imagens que aparecem no HTML */
export function imagensDoHtml(html: string): string[] {
  return [...html.matchAll(/<img[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1])
}

/** Nome do arquivo da imagem dentro do pacote (o último pedaço do endereço, sem caracteres estranhos) */
export function nomeDaImagem(url: string, usados: Set<string>) {
  const ultimo = decodeURIComponent(url.split('?')[0].split('/').pop() || 'imagem')
  const limpo = ultimo.replace(/[^\w.-]+/g, '_').slice(-80) || 'imagem'
  let nome = limpo
  let k = 2
  while (usados.has(nome)) nome = limpo.replace(/(\.[^.]*)?$/, (ext) => `-${k++}${ext}`)
  usados.add(nome)
  return nome
}

const DIA = 86400

export async function exportarParaAnki(d: DadosExportacao): Promise<ResultadoExportacao> {
  const [{ default: initSqlJs }, { default: wasm }, { zipSync }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm-browser.wasm?url'),
    import('fflate'),
  ])
  const SQL = await initSqlJs({ locateFile: () => wasm })
  const db = new SQL.Database()

  const agora = Date.now()
  const hoje = new Date()
  hoje.setHours(4, 0, 0, 0) // o Anki vira o dia às 4h
  const crt = Math.floor(hoje.getTime() / 1000)

  db.run(`
    CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
    CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
  `)

  // baralhos (com os de cima, para "A::B" ter o "A")
  const decks: Record<number, ReturnType<typeof baralho>> = { 1: baralho(1, 'Default', agora) }
  const idDoBaralho = new Map<string, number>()
  let proximoBaralho = agora
  const garantirBaralho = (nome: string) => {
    const partes = nome.split('::')
    let id = 1
    for (let i = 1; i <= partes.length; i++) {
      const caminho = partes.slice(0, i).join('::')
      let existente = idDoBaralho.get(caminho)
      if (!existente) {
        existente = ++proximoBaralho
        idDoBaralho.set(caminho, existente)
        decks[existente] = baralho(existente, caminho, agora)
      }
      id = existente
    }
    return id
  }
  const disciplinaPorId = new Map(d.disciplinas.map((x) => [x.id, x]))
  const topicoPorId = new Map(d.topicos.map((x) => [x.id, x]))

  // imagens: cada endereço vira um arquivo do pacote
  const urls = new Set<string>()
  const notasLimpas = d.notas.map((n) => {
    const frente = limparHtml(n.frente)
    const verso = limparHtml(n.verso)
    for (const u of [...imagensDoHtml(frente), ...imagensDoHtml(verso)]) urls.add(u)
    return { n, frente, verso }
  })
  const usados = new Set<string>()
  const nomePorUrl = new Map<string, string>()
  const midia: Record<string, string> = {}
  const arquivos: Record<string, Uint8Array> = {}
  let falharam = 0
  const lista = [...urls]
  for (let i = 0; i < lista.length; i += 4) {
    d.aoProgredir?.(`Baixando imagens (${Math.min(i + 4, lista.length)} de ${lista.length})…`)
    await Promise.all(
      lista.slice(i, i + 4).map(async (url) => {
        const bytes = await d.baixarImagem(url).catch(() => null)
        if (!bytes) {
          falharam++
          return
        }
        const nome = nomeDaImagem(url, usados)
        nomePorUrl.set(url, nome)
        const k = String(Object.keys(midia).length)
        midia[k] = nome
        arquivos[k] = bytes
      }),
    )
  }
  const trocarImagens = (html: string) =>
    html.replace(/(<img[^>]*\bsrc=")([^"]+)(")/gi, (todo, a: string, url: string, b: string) => (nomePorUrl.has(url) ? a + nomePorUrl.get(url) + b : todo))

  d.aoProgredir?.('Montando o pacote…')
  const inserirNota = db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  const inserirCartao = db.prepare('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  let proximoId = agora
  let nCartoes = 0
  const mod = Math.floor(agora / 1000)

  for (const { n, frente, verso } of notasLimpas) {
    const disc = disciplinaPorId.get(n.disciplina_id)
    const topico = n.topico_id ? topicoPorId.get(n.topico_id) : undefined
    const nome = nomeBaralho(disc?.nome ?? 'Aprovi') + (topico ? '::' + nomeBaralho(topico.nome) : '')
    const did = garantirBaralho(nome)
    const mid = n.tipo === 'omissao' ? ID_OMISSAO : n.tipo === 'digitar' ? ID_DIGITAR : ID_BASICO
    const campos = [trocarImagens(frente), trocarImagens(verso)]
    const sfld = textoDoCampo(campos[0])
    const nid = ++proximoId
    inserirNota.run([nid, guidDaNota(n), mid, mod, -1, ' Aprovi ', campos.join('\x1f'), sfld, await checksum(sfld), 0, ''])

    const cartoes = (d.cartoesPorNota.get(n.id) ?? []).slice().sort((a, b) => a.ordem - b.ordem)
    for (const c of cartoes) {
      const ord = n.tipo === 'omissao' ? Math.max(0, c.ordem - 1) : 0
      const revisao = d.comProgresso && (c.estado === 2 || c.estado === 3)
      const vence = Math.floor(new Date(c.vence_em).getTime() / 1000)
      const due = revisao ? Math.floor((vence - crt) / DIA) : c.posicao
      const dados = revisao && c.estabilidade > 0 ? JSON.stringify({ s: Number(c.estabilidade.toFixed(4)), d: Number(c.dificuldade.toFixed(4)) }) : ''
      inserirCartao.run([
        ++proximoId,
        nid,
        did,
        ord,
        mod,
        -1,
        revisao ? 2 : 0, // tipo: 0 novo, 2 revisão
        c.suspenso ? -1 : revisao ? 2 : 0, // fila
        due,
        revisao ? Math.max(1, Math.round(c.dias_agendados)) : 0,
        revisao ? 2500 : 0,
        d.comProgresso ? c.repeticoes : 0,
        d.comProgresso ? c.lapsos : 0,
        0,
        0,
        0,
        0,
        dados,
      ])
      nCartoes++
    }
  }
  inserirNota.free()
  inserirCartao.free()

  const conf = {
    activeDecks: [1],
    curDeck: 1,
    newSpread: 0,
    collapseTime: 1200,
    timeLim: 0,
    estTimes: true,
    dueCounts: true,
    curModel: null,
    nextPos: d.notas.length + 1,
    sortType: 'noteFld',
    sortBackwards: false,
    addToCur: true,
  }
  db.run('INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,?)', [
    crt,
    agora,
    agora,
    JSON.stringify(conf),
    JSON.stringify(modelos(agora)),
    JSON.stringify(decks),
    JSON.stringify(CONFIG_BARALHO),
    '{}',
  ])
  const colecao = db.export()
  db.close()

  const arquivo = zipSync({ 'collection.anki2': colecao, media: new TextEncoder().encode(JSON.stringify(midia)), ...arquivos }, { level: 6 })
  return { arquivo, notas: d.notas.length, cartoes: nCartoes, imagens: Object.keys(midia).length, imagensQueFalharam: falharam }
}
