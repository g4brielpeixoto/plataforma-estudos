export type Papel = 'master' | 'usuario'
export type Origem = 'manual' | 'cronometro' | 'timer' | 'pomodoro'
/** 0 = tópico, 1 = subtópico, 2 = subtópico do subtópico */
export type NivelTopico = 0 | 1 | 2

export interface Perfil {
  user_id: string
  email: string
  papel: Papel
  ativo: boolean
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
  topico_id: string
  data_hora: string
  duracao_segundos: number | null
  questoes_feitas: number | null
  questoes_acertadas: number | null
  origem: Origem
  observacao: string | null
  criado_em: string
}

export type NovoEstudo = Pick<
  Estudo,
  'topico_id' | 'data_hora' | 'duracao_segundos' | 'questoes_feitas' | 'questoes_acertadas' | 'origem' | 'observacao'
>

export interface Metas {
  user_id: string
  minutos_semana: number | null
  questoes_semana: number | null
  atualizado_em: string
}
