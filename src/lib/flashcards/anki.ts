import type { TipoNotaFlash } from '@/types'
import type { CamposAgenda } from './agenda'
import { limparHtmlComInfo, textoParaHtml, textoPuro, type MapearSrc } from './html'
import { tipoPeloNome, tipoPelosBytes } from './imagens'
import { numerosOmissao } from './omissao'

/*
  Leitura de arquivos exportados pelo Anki, toda no navegador:
  - .apkg / .colpkg: zip com o banco SQLite da coleção. No formato novo (Anki 2.1.50+) o banco é
    "collection.anki21b", comprimido com zstd e no esquema 18 (tabela decks, nomes com \x1f).
    No formato antigo é "collection.anki21" ou "collection.anki2" (esquema 11, baralhos em JSON na tabela col).
  - .txt: "Notas em texto puro", com cabeçalhos #separator, #html, #deck column…
  Imagens: no .apkg vêm como arquivos numerados ("0", "1"…) e um índice "media" — JSON no formato antigo;
  no novo, protobuf comprimido com zstd, e cada arquivo também em zstd. No texto das notas, a imagem vira
  <img src="anki-midia:NOME"> até ser enviada para o bucket na hora de importar.
  As bibliotecas (fflate, fzstd, sql.js) só são carregadas quando alguém importa.
*/

/** Prefixo provisório das imagens do pacote, trocado pelo endereço no bucket ao importar */
export const PREFIXO_MIDIA = 'anki-midia:'

export interface CartaoImportado {
  /** 0 no básico; número da omissão na omissão */
  ordem: number
  /** progresso no Anki (null = entra como novo) */
  agenda: CamposAgenda | null
  suspenso: boolean
  /** posição de novo no Anki, para manter a ordem */
  posicao: number
}

export interface NotaImportada {
  origem: string
  baralho: string
  tipo: TipoNotaFlash
  frente: string
  verso: string
  cartoes: CartaoImportado[]
  /** nomes das imagens do pacote usadas na nota */
  midias: string[]
}

export interface BaralhoImportado {
  nome: string
  notas: number
  cartoes: number
}

export interface ColecaoImportada {
  formato: 'apkg' | 'txt'
  notas: NotaImportada[]
  baralhos: BaralhoImportado[]
  /** algum cartão já tinha sido estudado no Anki */
  comProgresso: boolean
  /** cartões invertidos (verso → frente), que não são importados */
  invertidos: number
  /** notas sem texto na frente */
  vazias: number
  /** imagens citadas nas notas que não vieram no arquivo (exportado sem mídia, ou .txt) */
  imagensFaltando: number
  /** lê as imagens do pacote (só existe no .apkg/.colpkg) */
  lerMidias: (nomes: string[]) => Promise<Map<string, Blob>>
}

const semMidias = async () => new Map<string, Blob>()

/** Nome da imagem como o Anki guarda: sem %20 e afins */
function nomeDaMidia(src: string) {
  let nome = src.trim()
  try {
    nome = decodeURIComponent(nome)
  } catch {
    /* fica como está */
  }
  return nome.normalize('NFC')
}

/** Lê o índice "media" do formato novo: protobuf MediaEntries { repeated MediaEntry entries = 1 } */
export function lerIndiceProtobuf(b: Uint8Array): Map<string, string> {
  let i = 0
  const varint = (fim: number) => {
    let r = 0
    let mult = 1
    while (i < fim) {
      const byte = b[i++]
      r += (byte & 0x7f) * mult
      if (byte < 0x80) break
      mult *= 128
    }
    return r
  }
  const indice = new Map<string, string>()
  let posicao = 0
  while (i < b.length) {
    const chave = varint(b.length)
    const tipo = chave & 7
    if (chave >>> 3 === 1 && tipo === 2) {
      const tam = varint(b.length)
      const fim = i + tam
      let nome = ''
      let arquivoZip: number | null = null
      while (i < fim) {
        const k = varint(fim)
        const campo = k >>> 3
        const t = k & 7
        if (t === 2) {
          const n = varint(fim)
          if (campo === 1) nome = new TextDecoder().decode(b.slice(i, i + n))
          i += n
        } else if (t === 0) {
          const v = varint(fim)
          if (campo === 255) arquivoZip = v
        } else if (t === 5) i += 4
        else if (t === 1) i += 8
        else break
      }
      i = fim
      if (nome) indice.set(nome.normalize('NFC'), String(arquivoZip ?? posicao))
      posicao++
    } else if (tipo === 2) i += varint(b.length)
    else if (tipo === 0) varint(b.length)
    else if (tipo === 5) i += 4
    else if (tipo === 1) i += 8
    else break
  }
  return indice
}

const ZSTD = (b: Uint8Array) => b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd

export class ErroImportacao extends Error {}

const SEP_CAMPOS = '\x1f'

// ---------- .apkg / .colpkg ----------

export async function lerArquivoAnki(arquivo: File): Promise<ColecaoImportada> {
  const nome = arquivo.name.toLowerCase()
  if (/\.(txt|tsv|csv)$/.test(nome)) return lerTextoAnki(await arquivo.text())
  if (!/\.(apkg|colpkg)$/.test(nome)) throw new ErroImportacao('Escolha um arquivo .apkg, .colpkg ou .txt exportado pelo Anki.')

  const [{ unzipSync }, { decompress }] = await Promise.all([import('fflate'), import('fzstd')])
  const zip = new Uint8Array(await arquivo.arrayBuffer())
  let arquivos: Record<string, Uint8Array>
  try {
    arquivos = unzipSync(zip, { filter: (f) => f.name.startsWith('collection.') || f.name === 'media' })
  } catch {
    throw new ErroImportacao('Não consegui abrir o arquivo. Exporte de novo no Anki como "Pacote de baralho do Anki (.apkg)".')
  }

  let banco: Uint8Array | undefined
  if (arquivos['collection.anki21b']) banco = decompress(arquivos['collection.anki21b'])
  else banco = arquivos['collection.anki21'] ?? arquivos['collection.anki2']
  if (!banco) throw new ErroImportacao('O arquivo não tem uma coleção do Anki dentro. Exporte de novo como .apkg.')

  // índice das imagens: nome → arquivo dentro do zip
  let indice = new Map<string, string>()
  const media = arquivos['media']
  if (media?.length) {
    try {
      const json = JSON.parse(new TextDecoder().decode(media)) as Record<string, string>
      indice = new Map(Object.entries(json).map(([arquivoZip, nome]) => [nome.normalize('NFC'), arquivoZip]))
    } catch {
      try {
        indice = lerIndiceProtobuf(ZSTD(media) ? decompress(media) : media)
      } catch {
        indice = new Map()
      }
    }
  }

  const lerMidias = async (nomes: string[]) => {
    const procurados = new Map<string, string>()
    for (const n of nomes) {
      const z = indice.get(n)
      if (z) procurados.set(z, n)
    }
    const saida = new Map<string, Blob>()
    if (!procurados.size) return saida
    const brutos = unzipSync(zip, { filter: (f) => procurados.has(f.name) })
    for (const [arquivoZip, bytes] of Object.entries(brutos)) {
      const nome = procurados.get(arquivoZip)!
      const dados = ZSTD(bytes) ? decompress(bytes) : bytes
      const tipo = tipoPelosBytes(dados) ?? tipoPeloNome(nome) ?? 'application/octet-stream'
      saida.set(nome, new Blob([dados as BlobPart], { type: tipo }))
    }
    return saida
  }

  const [{ default: initSqlJs }, { default: wasm }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm-browser.wasm?url')])
  const SQL = await initSqlJs({ locateFile: () => wasm })
  const db = new SQL.Database(banco)
  try {
    return { ...lerBanco(db, indice), lerMidias }
  } finally {
    db.close()
  }
}

/**
  Limpa o HTML de um campo do Anki guardando as imagens do pacote como "anki-midia:NOME".
  Devolve também os nomes usados e quantas imagens não estavam no pacote.
*/
function limparCampo(html: string, indice: Map<string, string>) {
  const usadas = new Set<string>()
  let faltando = 0
  const mapear: MapearSrc = (src) => {
    const nome = nomeDaMidia(src)
    if (indice.has(nome)) {
      usadas.add(nome)
      return PREFIXO_MIDIA + encodeURIComponent(nome)
    }
    faltando++
    return null
  }
  const r = limparHtmlComInfo(html ?? '', mapear)
  return { html: r.html, usadas, faltando }
}

type Banco = { exec: (sql: string) => { columns: string[]; values: unknown[][] }[] }

const linhas = (db: Banco, sql: string) => db.exec(sql)[0]?.values ?? []

/** Fator de facilidade do Anki (2500 = 250%) → dificuldade do FSRS (1 a 10) */
export function dificuldadeDoFator(fator: number) {
  if (!fator) return 5
  const d = 11 - ((fator / 1000 - 1.3) / 1.2) * 6
  return Math.round(Math.min(10, Math.max(1, d)) * 100) / 100
}

interface CartaoAnki {
  nid: number
  did: number
  ord: number
  type: number
  queue: number
  due: number
  ivl: number
  factor: number
  reps: number
  lapses: number
  data: string
}

/** Progresso do cartão no Anki → campos do FSRS (aproximado quando o Anki não usava FSRS) */
export function agendaDoAnki(c: CartaoAnki, crt: number, agora = new Date()): CamposAgenda | null {
  // novo ou em aprendizado inicial: começa do zero aqui
  if (c.type !== 2 && c.type !== 3) return null
  let extra: { s?: number; d?: number; lrt?: number } = {}
  try {
    extra = c.data ? JSON.parse(c.data) : {}
  } catch {
    extra = {}
  }
  const dia = (n: number) => new Date((crt + n * 86_400) * 1000)
  // na fila 1 o "due" é em segundos; nas outras, em dias desde a criação da coleção
  const vence = c.queue === 1 ? new Date(c.due * 1000) : dia(c.due)
  const intervalo = Math.max(1, c.ivl)
  const ultima = extra.lrt ? new Date(extra.lrt * 1000) : new Date(Math.min(agora.getTime(), vence.getTime() - intervalo * 86_400_000))
  return {
    estado: 2,
    vence_em: vence.toISOString(),
    estabilidade: Math.max(0.1, extra.s ?? intervalo),
    dificuldade: extra.d ? Math.min(10, Math.max(1, extra.d)) : dificuldadeDoFator(c.factor),
    dias_agendados: intervalo,
    passo: 0,
    repeticoes: Math.max(0, c.reps),
    lapsos: Math.max(0, c.lapses),
    ultima_revisao: ultima.toISOString(),
  }
}

function lerBanco(db: Banco, indice: Map<string, string>): Omit<ColecaoImportada, 'lerMidias'> {
  const tabelas = new Set(linhas(db, "select name from sqlite_master where type = 'table'").map((l) => String(l[0])))
  if (!tabelas.has('notes') || !tabelas.has('cards')) throw new ErroImportacao('O arquivo não tem notas do Anki.')
  const crt = Number(linhas(db, 'select crt from col')[0]?.[0] ?? 0)

  // baralhos: tabela própria no formato novo; JSON na tabela col no antigo
  const baralhos = new Map<number, string>()
  if (tabelas.has('decks')) {
    for (const [id, nome] of linhas(db, 'select id, name from decks')) baralhos.set(Number(id), String(nome).split(SEP_CAMPOS).join('::'))
  } else {
    const json = JSON.parse(String(linhas(db, 'select decks from col')[0]?.[0] ?? '{}')) as Record<string, { id: number; name: string }>
    for (const d of Object.values(json)) baralhos.set(Number(d.id), d.name)
  }

  const notasAnki = new Map<number, { guid: string; campos: string[] }>()
  for (const [id, guid, flds] of linhas(db, 'select id, guid, flds from notes')) notasAnki.set(Number(id), { guid: String(guid), campos: String(flds).split(SEP_CAMPOS) })

  // a coleção "de mentira" que o formato novo inclui para versões antigas do Anki
  if (notasAnki.size === 1 && [...notasAnki.values()][0].campos[0].startsWith('Please update to the latest Anki version'))
    throw new ErroImportacao('Este arquivo precisa do formato novo do Anki. Exporte de novo pelo Anki atualizado.')

  const cartoesPorNota = new Map<number, CartaoAnki[]>()
  for (const l of linhas(db, 'select nid, did, ord, type, queue, due, ivl, factor, reps, lapses, data from cards order by nid, ord')) {
    const c: CartaoAnki = {
      nid: Number(l[0]),
      did: Number(l[1]),
      ord: Number(l[2]),
      type: Number(l[3]),
      queue: Number(l[4]),
      due: Number(l[5]),
      ivl: Number(l[6]),
      factor: Number(l[7]),
      reps: Number(l[8]),
      lapses: Number(l[9]),
      data: l[10] == null ? '' : String(l[10]),
    }
    const lista = cartoesPorNota.get(c.nid)
    if (lista) lista.push(c)
    else cartoesPorNota.set(c.nid, [c])
  }

  const agora = new Date()
  const r: Omit<ColecaoImportada, 'lerMidias'> = { formato: 'apkg', notas: [], baralhos: [], comProgresso: false, invertidos: 0, vazias: 0, imagensFaltando: 0 }

  for (const [nid, nota] of notasAnki) {
    const cartoes = cartoesPorNota.get(nid) ?? []
    if (!cartoes.length) continue
    const baralho = baralhos.get(cartoes[0].did) ?? 'Importado do Anki'
    const omissao = numerosOmissao(nota.campos[0] ?? '').length > 0
    const montada = montarNota(nota.campos, omissao, indice)
    r.imagensFaltando += montada.faltando
    if (!montada.frente) {
      r.vazias++
      continue
    }
    const importados: CartaoImportado[] = []
    if (omissao) {
      const porOrdem = new Map(cartoes.map((c) => [c.ord + 1, c]))
      for (const n of numerosOmissao(montada.frente)) {
        const c = porOrdem.get(n)
        importados.push(cartaoImportado(n, c, crt, agora))
      }
    } else {
      r.invertidos += cartoes.filter((c) => c.ord > 0).length
      importados.push(cartaoImportado(0, cartoes.find((c) => c.ord === 0), crt, agora))
    }
    if (importados.some((c) => c.agenda)) r.comProgresso = true
    r.notas.push({ origem: `anki:${nota.guid}`, baralho, tipo: omissao ? 'omissao' : 'basico', frente: montada.frente, verso: montada.verso, cartoes: importados, midias: montada.midias })
  }
  r.baralhos = resumirBaralhos(r.notas)
  return r
}

function cartaoImportado(ordem: number, c: CartaoAnki | undefined, crt: number, agora: Date): CartaoImportado {
  if (!c) return { ordem, agenda: null, suspenso: false, posicao: 0 }
  return { ordem, agenda: agendaDoAnki(c, crt, agora), suspenso: c.queue === -1, posicao: c.type === 0 ? Math.max(0, c.due) : 0 }
}

/** Campos da nota → frente e verso. Campos a mais (tipos de nota personalizados) vão para o verso */
function montarNota(campos: string[], omissao: boolean, indice: Map<string, string>) {
  let faltando = 0
  const midias = new Set<string>()
  const limpar = (h: string) => {
    const r = limparCampo(h, indice)
    faltando += r.faltando
    r.usadas.forEach((n) => midias.add(n))
    return r.html
  }
  const frente = limpar(campos[0] ?? '')
  const extras = campos
    .slice(omissao ? 1 : 2)
    .map(limpar)
    // "y" é o marcador de "adicionar invertido" de alguns tipos de nota
    .filter((h) => textoPuro(h).length > 1)
  const verso = [omissao ? '' : limpar(campos[1] ?? ''), ...extras].filter(Boolean).join('<hr>')
  return { frente: textoPuro(frente) || /<img\b/.test(frente) ? frente : '', verso, faltando, midias: [...midias] }
}

function resumirBaralhos(notas: NotaImportada[]): BaralhoImportado[] {
  const mapa = new Map<string, BaralhoImportado>()
  for (const n of notas) {
    const b = mapa.get(n.baralho) ?? { nome: n.baralho, notas: 0, cartoes: 0 }
    b.notas++
    b.cartoes += n.cartoes.length
    mapa.set(n.baralho, b)
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ---------- .txt (notas em texto puro) ----------

const SEPARADORES: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ', colon: ':' }

/** Divide uma linha CSV respeitando aspas ("" vira ") — também aceita quebras de linha dentro das aspas */
export function dividirCsv(texto: string, sep: string): string[][] {
  const linhasCsv: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else aspas = false
      } else campo += ch
      continue
    }
    if (ch === '"' && campo === '') aspas = true
    else if (ch === sep) {
      linha.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      linhasCsv.push(linha)
      linha = []
      campo = ''
    } else campo += ch
  }
  if (campo !== '' || linha.length) {
    linha.push(campo)
    linhasCsv.push(linha)
  }
  return linhasCsv
}

/** Identificador estável para notas sem guid (FNV-1a) */
function resumoHash(texto: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function lerTextoAnki(texto: string): ColecaoImportada {
  const linhasTexto = texto.replace(/^﻿/, '').split(/\r?\n/)
  const cab: Record<string, string> = {}
  let inicio = 0
  while (inicio < linhasTexto.length && linhasTexto[inicio].startsWith('#')) {
    const m = linhasTexto[inicio].match(/^#([^:]+):(.*)$/)
    if (m) cab[m[1].trim().toLowerCase()] = m[2].trim()
    inicio++
  }
  const corpo = linhasTexto.slice(inicio).join('\n')
  const sep = SEPARADORES[cab['separator']?.toLowerCase() ?? ''] ?? cab['separator'] ?? (corpo.includes('\t') ? '\t' : ';')
  const html = (cab['html'] ?? 'true').toLowerCase() === 'true'
  const coluna = (k: string) => (cab[k] ? Number(cab[k]) - 1 : -1)
  const colTipo = coluna('notetype column')
  const colBaralho = coluna('deck column')
  const colTags = coluna('tags column')
  const colGuid = coluna('guid column')
  const especiais = new Set([colTipo, colBaralho, colTags, colGuid].filter((c) => c >= 0))

  const r: ColecaoImportada = { formato: 'txt', notas: [], baralhos: [], comProgresso: false, invertidos: 0, vazias: 0, imagensFaltando: 0, lerMidias: semMidias }
  const vistos = new Set<string>()
  for (const linha of dividirCsv(corpo, sep)) {
    if (!linha.some((c) => c.trim())) continue
    const campos = linha.filter((_, i) => !especiais.has(i)).map((c) => (html ? c : textoParaHtml(c)))
    const omissao = numerosOmissao(campos[0] ?? '').length > 0
    let imagens = 0
    const limpar = (h: string) => {
      // o .txt não traz os arquivos das imagens
      const x = limparHtmlComInfo(h, () => null)
      imagens += x.imagens
      return x.html
    }
    const frente = limpar(campos[0] ?? '')
    const verso = limpar(campos[1] ?? '')
    r.imagensFaltando += imagens
    if (!frente) {
      r.vazias++
      continue
    }
    const baralho = (colBaralho >= 0 ? linha[colBaralho] : cab['deck']) || 'Importado do Anki'
    const guid = colGuid >= 0 ? linha[colGuid] : ''
    const origem = guid ? `anki:${guid}` : `txt:${resumoHash(`${frente}\x1f${verso}`)}`
    if (vistos.has(origem)) continue
    vistos.add(origem)
    const ordens = omissao ? numerosOmissao(frente) : [0]
    r.notas.push({
      origem,
      baralho,
      tipo: omissao ? 'omissao' : 'basico',
      frente,
      verso,
      cartoes: ordens.map((ordem) => ({ ordem, agenda: null, suspenso: false, posicao: 0 })),
      midias: [],
    })
  }
  r.baralhos = resumirBaralhos(r.notas)
  return r
}
