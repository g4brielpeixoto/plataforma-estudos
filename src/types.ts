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

export type TipoPlanner = 'estudo' | 'resumo' | 'exercicios'

export interface ItemPlanner {
  id: string
  user_id: string
  /** yyyy-mm-dd */
  data: string
  /** dia em que foi planejado pela primeira vez */
  data_original: string
  disciplina_id: string
  topico_id: string | null
  tipo: TipoPlanner
  minutos_previstos: number | null
  observacao: string | null
  ordem: number
  adiamentos: number
  concluido_em: string | null
  estudo_id: string | null
  criado_em: string
}

export type TipoNotaFlash = 'basico' | 'omissao'
/** 0 novo, 1 aprendendo, 2 revisão, 3 reaprendendo (mesmos números do FSRS) */
export type EstadoCartao = 0 | 1 | 2 | 3
/** 1 errei, 2 difícil, 3 bom, 4 fácil */
export type RespostaFlash = 1 | 2 | 3 | 4

/** O conteúdo do flashcard. Uma nota de omissão gera um cartão por número ({{c1::}}, {{c2::}}…) */
export interface FlashNota {
  id: string
  user_id: string
  disciplina_id: string
  topico_id: string | null
  tipo: TipoNotaFlash
  /** básico: pergunta; omissão: texto com {{c1::…}} (HTML simples, já limpo) */
  frente: string
  /** básico: resposta; omissão: texto extra do verso */
  verso: string
  origem_anki: string | null
  criado_em: string
  atualizado_em: string
}

/** O que é revisado, com o agendamento (FSRS) */
export interface FlashCartao {
  id: string
  user_id: string
  nota_id: string
  /** 0 no básico; número da omissão na omissão */
  ordem: number
  estado: EstadoCartao
  vence_em: string
  estabilidade: number
  dificuldade: number
  dias_agendados: number
  passo: number
  repeticoes: number
  lapsos: number
  ultima_revisao: string | null
  suspenso: boolean
  posicao: number
  criado_em: string
}

export interface FlashRevisao {
  id: string
  user_id: string
  cartao_id: string
  resposta: RespostaFlash
  estado_antes: EstadoCartao
  dias_agendados: number
  duracao_ms: number
  revisado_em: string
}

export interface FlashConfig {
  user_id: string
  novos_por_dia: number
  revisoes_por_dia: number
  retencao: number
  atualizado_em: string
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
