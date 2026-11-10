/*
  Omissão de palavras (cloze), no formato do Anki: {{c1::resposta}} ou {{c1::resposta::dica}}.
  Cada número vira um cartão; no cartão N, só as omissões de número N ficam escondidas.
*/

const RE_OMISSAO = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g

/** Números das omissões presentes no texto, em ordem (ex.: [1, 2]) */
export function numerosOmissao(texto: string): number[] {
  const numeros = new Set<number>()
  for (const m of texto.matchAll(RE_OMISSAO)) {
    const n = Number(m[1])
    if (n >= 1 && n <= 500) numeros.add(n)
  }
  return [...numeros].sort((a, b) => a - b)
}

export const temOmissao = (texto: string) => numerosOmissao(texto).length > 0

/** Frente do cartão N: a omissão N vira [...] (ou [dica]); as outras aparecem normalmente */
export function frenteOmissao(texto: string, n: number): string {
  return texto.replace(RE_OMISSAO, (_t, num: string, conteudo: string, dica?: string) =>
    Number(num) === n ? `<span class="omissao">[${dica?.trim() ? dica : '...'}]</span>` : conteudo,
  )
}

/** Verso do cartão N: a omissão N aparece destacada */
export function versoOmissao(texto: string, n: number): string {
  return texto.replace(RE_OMISSAO, (_t, num: string, conteudo: string) =>
    Number(num) === n ? `<span class="omissao omissao-resposta">${conteudo}</span>` : conteudo,
  )
}

/** Próximo número livre (para o botão "Omissão" do editor) */
export function proximoNumero(texto: string) {
  const usados = numerosOmissao(texto)
  return usados.length ? usados[usados.length - 1] + 1 : 1
}

/** Texto do cartão em uma linha, sem as marcas (para listas e buscas) */
export const semMarcas = (texto: string) => texto.replace(RE_OMISSAO, (_t, _n, conteudo: string) => conteudo)
