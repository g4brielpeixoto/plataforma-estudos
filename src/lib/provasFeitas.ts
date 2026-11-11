import type { NotaDisciplina, ProvaFeita, SituacaoProva } from '@/types'

/*
  Provas que o usuário já fez (Raio-X). Cada prova pode ter três pares nota/corte:
  objetiva, discursiva e final. Nada aqui tem relação com a contagem regressiva (lib/provas.ts).
*/

export const ROTULO_SITUACAO: Record<SituacaoProva, string> = {
  aprovado: 'Aprovado',
  classificado: 'Classificado',
  nao_classificado: 'Não classificado',
  eliminado: 'Eliminado',
  aguardando: 'Aguardando resultado',
}

export type EtapaProva = 'objetiva' | 'discursiva' | 'final'
export const ROTULO_ETAPA: Record<EtapaProva, string> = { objetiva: 'Objetiva', discursiva: 'Discursiva', final: 'Pontuação total' }

export interface ParNota {
  etapa: EtapaProva
  nota: number | null
  corte: number | null
  /** pontos acima (positivo) ou abaixo (negativo) do corte; null sem as duas notas */
  distancia: number | null
}

const distancia = (nota: number | null, corte: number | null) => (nota === null || corte === null ? null : Math.round((nota - corte) * 100) / 100)

/** As etapas que têm alguma nota ou corte lançado, na ordem objetiva, discursiva, final */
export function etapasDaProva(p: ProvaFeita): ParNota[] {
  const pares: ParNota[] = [
    { etapa: 'objetiva', nota: p.nota_objetiva, corte: p.corte_objetiva, distancia: distancia(p.nota_objetiva, p.corte_objetiva) },
    { etapa: 'discursiva', nota: p.nota_discursiva, corte: p.corte_discursiva, distancia: distancia(p.nota_discursiva, p.corte_discursiva) },
    { etapa: 'final', nota: p.nota_final, corte: p.corte_final, distancia: distancia(p.nota_final, p.corte_final) },
  ]
  return pares.filter((e) => e.nota !== null || e.corte !== null)
}

/**
 * O par que resume a prova na comparação: a nota final contra o corte final quando os dois existem;
 * senão a objetiva; senão a discursiva. null se nenhuma etapa tem nota e corte.
 */
export function etapaPrincipal(p: ProvaFeita): ParNota | null {
  const completas = etapasDaProva(p).filter((e) => e.distancia !== null)
  return completas.find((e) => e.etapa === 'final') ?? completas.find((e) => e.etapa === 'objetiva') ?? completas[0] ?? null
}

/** "72,5" (até 2 casas, sem zeros sobrando) */
export const formatarNota = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** "2,5 acima do corte", "3 abaixo do corte", "No corte" */
export function textoDistancia(d: number): string {
  if (d === 0) return 'No corte'
  return `${formatarNota(Math.abs(d))} ${d > 0 ? 'acima' : 'abaixo'} do corte`
}

/** Lê o que foi digitado num campo de nota ("72,5" ou "72.5"); vazio = null; inválido = NaN */
export function lerNota(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  return /^\d{1,6}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN
}

/** Da mais recente para a mais antiga */
export const ordenarProvasFeitas = (provas: ProvaFeita[]) => [...provas].sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em))

/** Números do topo: provas lançadas, quantas dá para comparar, quantas no corte ou acima e a menor falta */
export function resumoProvasFeitas(provas: ProvaFeita[]) {
  const distancias = provas.map((p) => etapaPrincipal(p)?.distancia ?? null).filter((d): d is number => d !== null)
  const abaixo = distancias.filter((d) => d < 0)
  return {
    feitas: provas.length,
    comparaveis: distancias.length,
    noCorte: distancias.filter((d) => d >= 0).length,
    /** a vez em que faltou menos (número negativo); null se nunca ficou abaixo */
    menorFalta: abaixo.length ? Math.max(...abaixo) : null,
  }
}

/** Pontos do gráfico, em ordem de data (mais antiga primeiro): só provas com nota e corte na etapa principal */
export function pontosDoGrafico(provas: ProvaFeita[]) {
  return [...provas]
    .sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em))
    .flatMap((p) => {
      const e = etapaPrincipal(p)
      if (!e || e.nota === null || e.corte === null) return []
      return [{ id: p.id, nome: p.nome, ano: p.data.slice(0, 4), etapa: e.etapa, nota: e.nota, corte: e.corte, distancia: e.distancia as number }]
    })
}

/** "17/01/2027" a partir de "2027-01-17" (sem fuso) */
export const dataCurta = (data: string) => data.split('-').reverse().join('/')

// ---------- notas por disciplina ----------

/** Disciplinas que o diálogo já traz prontas (as que a prova não teve ficam em branco) */
export const DISCIPLINAS_PADRAO = [
  'Constitucional',
  'Administrativo',
  'Civil',
  'Processo Civil',
  'Trabalho',
  'Processo do Trabalho',
  'Previdenciário',
  'Legislação',
  'Português',
  'Informática',
  'RLM',
]

/** Para reconhecer a mesma disciplina escrita com maiúsculas, acentos ou espaços diferentes */
export const chaveDisciplina = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

/** As padrão, na ordem, e depois as outras que o usuário já lançou em alguma prova */
export function disciplinasConhecidas(provas: ProvaFeita[]): string[] {
  const nomes = [...DISCIPLINAS_PADRAO]
  const vistas = new Set(nomes.map(chaveDisciplina))
  for (const p of provas)
    for (const d of p.disciplinas ?? []) {
      const chave = chaveDisciplina(d.nome)
      if (chave && !vistas.has(chave)) {
        vistas.add(chave)
        nomes.push(d.nome.trim())
      }
    }
  return nomes
}

/** Aproveitamento na disciplina (0–100, inteiro); null sem o total */
export const pctDisciplina = (d: Pick<NotaDisciplina, 'nota' | 'total'>) => (d.total ? Math.round((d.nota / d.total) * 100) : null)

/** "8 de 10" ou só "8" */
export const textoNotaDisciplina = (d: Pick<NotaDisciplina, 'nota' | 'total'>) => (d.total ? `${formatarNota(d.nota)} de ${formatarNota(d.total)}` : formatarNota(d.nota))

/**
 * Tabela de comparação: uma linha por disciplina, uma coluna por prova (da mais antiga para a mais recente).
 * Só entram provas com alguma disciplina lançada e disciplinas que aparecem em alguma prova.
 * `geral` = aproveitamento somando as provas em que a disciplina tem total (null se nenhuma tem);
 * `media` = média das notas nas provas em que a disciplina caiu (usada quando não há total).
 */
export function comparacaoPorDisciplina(provas: ProvaFeita[]) {
  const colunas = [...provas].filter((p) => (p.disciplinas ?? []).length > 0).sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em))
  const linhas = disciplinasConhecidas(colunas)
    .map((nome) => {
      const chave = chaveDisciplina(nome)
      const celulas = colunas.map((p) => p.disciplinas.find((d) => chaveDisciplina(d.nome) === chave) ?? null)
      const notas = celulas.filter((c): c is NotaDisciplina => !!c).map((c) => c.nota)
      const comTotal = celulas.filter((c): c is NotaDisciplina => !!c && !!c.total)
      const total = comTotal.reduce((s, c) => s + (c.total as number), 0)
      const geral = total ? Math.round((comTotal.reduce((s, c) => s + c.nota, 0) / total) * 100) : null
      return { nome, celulas, geral, media: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100 : null }
    })
    .filter((l) => l.celulas.some(Boolean))
  return { colunas, linhas }
}
