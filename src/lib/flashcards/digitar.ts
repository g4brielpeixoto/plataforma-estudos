import { textoPuro } from './html'

/**
  Cartão "Digitar a resposta" (como o "Básico (digitar a resposta)" do Anki): na revisão a pessoa digita,
  e o que ela escreveu é comparado letra por letra com o texto do verso.
*/

export type ParteComparada = { texto: string; tipo: 'certo' | 'errado' | 'faltou' }

export type Comparacao = {
  /** igual ao verso (sem contar espaços repetidos nem espaços nas pontas) */
  igual: boolean
  /** só muda acento, maiúscula ou pontuação */
  quaseIgual: boolean
  vazia: boolean
  /** o que foi digitado: certo (verde) ou errado (vermelho) */
  digitada: ParteComparada[]
  /** a resposta certa: certo ou faltou (o que a pessoa não escreveu) */
  esperada: ParteComparada[]
}

const LIMITE = 2000

export function normalizarResposta(texto: string) {
  return texto.replace(/\s+/g, ' ').trim()
}

/** Texto do verso que a pessoa tem que digitar */
export function respostaEsperada(versoHtml: string) {
  return normalizarResposta(textoPuro(versoHtml))
}

function chaveSolta(t: string) {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function juntar(partes: ParteComparada[], texto: string, tipo: ParteComparada['tipo']) {
  const ult = partes[partes.length - 1]
  if (ult && ult.tipo === tipo) ult.texto += texto
  else partes.push({ texto, tipo })
}

/** Compara letra por letra (maior subsequência comum), no estilo do Anki */
export function compararResposta(digitadaBruta: string, esperadaBruta: string): Comparacao {
  const a = normalizarResposta(digitadaBruta)
  const b = normalizarResposta(esperadaBruta)
  const igual = a === b
  const quaseIgual = !igual && a.length > 0 && chaveSolta(a) === chaveSolta(b)
  if (!a) return { igual: false, quaseIgual: false, vazia: true, digitada: [], esperada: b ? [{ texto: b, tipo: 'faltou' }] : [] }
  if (igual) return { igual, quaseIgual, vazia: false, digitada: [{ texto: a, tipo: 'certo' }], esperada: [{ texto: b, tipo: 'certo' }] }

  // texto muito grande: não vale a pena alinhar letra por letra
  if (a.length > LIMITE || b.length > LIMITE) {
    return { igual, quaseIgual, vazia: false, digitada: [{ texto: a, tipo: 'errado' }], esperada: [{ texto: b, tipo: 'faltou' }] }
  }

  const A = Array.from(a)
  const B = Array.from(b)
  const n = A.length
  const m = B.length
  // tabela da maior subsequência comum, de trás para frente
  const t: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i][j] = A[i] === B[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
    }
  }
  const digitada: ParteComparada[] = []
  const esperada: ParteComparada[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      juntar(digitada, A[i], 'certo')
      juntar(esperada, B[j], 'certo')
      i++
      j++
    } else if (t[i + 1][j] >= t[i][j + 1]) {
      juntar(digitada, A[i], 'errado')
      i++
    } else {
      juntar(esperada, B[j], 'faltou')
      j++
    }
  }
  while (i < n) juntar(digitada, A[i++], 'errado')
  while (j < m) juntar(esperada, B[j++], 'faltou')
  return { igual, quaseIgual, vazia: false, digitada, esperada }
}
