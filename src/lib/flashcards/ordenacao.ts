/*
  Ordem da lista de cartões no baralho. A alfabética compara os números como números
  ("Art. 9º" antes de "Art. 11-A", que vem antes de "Art. 855"), sem ligar para acento,
  maiúscula ou para o que não é letra nem número no começo ("...CLT" fica junto de "CLT").
*/

export type OrdemNotas = 'antigos' | 'recentes' | 'az' | 'za' | 'revisao' | 'topico'

export const ROTULO_ORDEM: Record<OrdemNotas, string> = {
  antigos: 'Mais antigos primeiro',
  recentes: 'Mais recentes primeiro',
  az: 'Ordem alfabética (A–Z)',
  za: 'Ordem alfabética (Z–A)',
  revisao: 'Próxima revisão',
  topico: 'Tópico (ordem do edital)',
}

export const ORDENS = Object.keys(ROTULO_ORDEM) as OrdemNotas[]
export const ehOrdem = (v: unknown): v is OrdemNotas => typeof v === 'string' && (ORDENS as string[]).includes(v)

const colador = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/** O texto como entra na comparação: sem pontuação nem espaço no começo */
export const chaveAlfabetica = (texto: string) => texto.replace(/^[^\p{L}\p{N}]+/u, '')

export const compararTexto = (a: string, b: string) => colador.compare(chaveAlfabetica(a), chaveAlfabetica(b))

export interface ItemOrdenavel {
  /** texto da frente, já sem HTML nem marcas de omissão */
  texto: string
  criadoEm: string
  /** quando volta (ms); novos e suspensos com número bem alto, para irem ao fim */
  revisao: number
  /** posição do tópico no edital; sem tópico = Infinity */
  topico: number
}

/** Devolve uma cópia ordenada; empates ficam em ordem alfabética e depois por criação */
export function ordenarNotas<T extends ItemOrdenavel>(itens: T[], ordem: OrdemNotas): T[] {
  const criacao = (a: T, b: T) => a.criadoEm.localeCompare(b.criadoEm)
  const alfabetica = (a: T, b: T) => compararTexto(a.texto, b.texto) || criacao(a, b)
  const comparar: Record<OrdemNotas, (a: T, b: T) => number> = {
    antigos: criacao,
    recentes: (a, b) => criacao(b, a),
    az: alfabetica,
    za: (a, b) => alfabetica(b, a),
    revisao: (a, b) => a.revisao - b.revisao || alfabetica(a, b),
    topico: (a, b) => (a.topico === b.topico ? 0 : a.topico < b.topico ? -1 : 1) || alfabetica(a, b),
  }
  return [...itens].sort(comparar[ordem])
}
