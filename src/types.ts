export type Papel = 'master' | 'usuario'
export type Origem = 'manual' | 'cronometro' | 'timer' | 'pomodoro'
/** 0 = tópico, 1 = subtópico, 2 = subtópico do subtópico */
export type NivelTopico = 0 | 1 | 2

export interface Perfil {
  user_id: string
  email: string
  papel: Papel
  ativo: boolean
  /** como a pessoa quer ser chamada (opcional) */
  nome: string | null
  /** link público da foto de perfil (opcional) */
  foto_url: string | null
  criado_em: string
}

export interface Convite {
  email: string
  papel: Papel
  convidado_por: string | null
  criado_em: string
  usado_em: string | null
}

export interface Disciplina {
  id: string
  user_id: string
  nome: string
  cor: string
  ordem: number
  /** sigla curta (DC, PORT…) para o quadro e a roda do ciclo; vazia = sugerida pelo nome */
  sigla: string | null
  criado_em: string
}

export interface Topico {
  id: string
  user_id: string
  disciplina_id: string
  nome: string
  ordem: number
  /** 0 = tópico, 1 = subtópico, 2 = subtópico do subtópico (pertence ao item acima com um nível a menos) */
  nivel: NivelTopico
  concluido: boolean
  concluido_em: string | null
  /** meta do ciclo a que o tópico pertence (os subtópicos acompanham o tópico de cima) */
  meta_id: string | null
  criado_em: string
}

export interface Estudo {
  id: string
  user_id: string
  /** a disciplina do estudo (com tópico, é sempre a do tópico) */
  disciplina_id: string
  /** sem tópico: estudo da disciplina como um todo (ex.: sessão de flashcards) */
  topico_id: string | null
  data_hora: string
  duracao_segundos: number | null
  questoes_feitas: number | null
  questoes_acertadas: number | null
  origem: Origem
  observacao: string | null
  /** o que foi feito: Teoria, Questões, Revisão, Flashcards ou outra criada pelo usuário */
  categoria: string | null
  criado_em: string
}

export type NovoEstudo = Pick<
  Estudo,
  'disciplina_id' | 'topico_id' | 'data_hora' | 'duracao_segundos' | 'questoes_feitas' | 'questoes_acertadas' | 'origem' | 'observacao' | 'categoria'
>

export interface Metas {
  user_id: string
  minutos_semana: number | null
  questoes_semana: number | null
  atualizado_em: string
}

export type SituacaoProva = 'aprovado' | 'classificado' | 'nao_classificado' | 'eliminado' | 'aguardando'

/** Prova que o usuário já fez (Raio-X); separada de `Prova`, que é a contagem regressiva */
/** As duas listas do Raio-X que usam a tabela `provas_feitas` */
export type TipoProvaFeita = 'prova' | 'simulado'

export interface ProvaFeita {
  id: string
  user_id: string
  tipo: TipoProvaFeita
  nome: string
  cargo: string | null
  banca: string | null
  /** yyyy-mm-dd */
  data: string
  nota_objetiva: number | null
  corte_objetiva: number | null
  nota_discursiva: number | null
  corte_discursiva: number | null
  nota_final: number | null
  corte_final: number | null
  situacao: SituacaoProva | null
  classificacao: number | null
  observacao: string | null
  /** nota de cada disciplina que a prova teve */
  disciplinas: NotaDisciplina[]
  criado_em: string
}

/** Nota numa disciplina da prova; `total` = quanto a disciplina valia (questões ou pontos), opcional */
export interface NotaDisciplina {
  nome: string
  nota: number
  total: number | null
}

/** O que o diálogo grava */
export type DadosProvaFeita = Omit<ProvaFeita, 'id' | 'user_id' | 'criado_em'>

export interface Prova {
  id: string
  user_id: string
  nome: string
  /** yyyy-mm-dd */
  data: string
  criado_em: string
}

/** Link de material de um tópico (texto próprio, PDF, vídeo…) */
export interface Material {
  id: string
  user_id: string
  topico_id: string
  titulo: string | null
  url: string
  criado_em: string
}

/** Meta do ciclo: um grupo de tópicos seguidos do edital de uma disciplina */
export interface CicloMeta {
  id: string
  user_id: string
  disciplina_id: string
  ordem: number
  nome: string
  orientacoes: string
  criado_em: string
}

/** O ciclo da pessoa: disciplinas que se revezam, a posição atual e a meta da vez */
export interface Ciclo {
  user_id: string
  sequencia: string[]
  posicao: number
  meta_id: string | null
  atualizado_em: string
}
