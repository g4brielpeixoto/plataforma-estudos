import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { caminhoDaFoto } from '@/lib/foto'
import { buscarTodos, supabase } from '@/lib/supabase'
import type { Ciclo, CicloMeta, Convite, DadosProvaFeita, Disciplina, Estudo, Material, Metas, NivelTopico, NovoEstudo, Perfil, Prova, ProvaFeita, Topico } from '@/types'

/*
  Acesso aos dados. Toda leitura usa o React Query (cache + recarga automática);
  toda escrita invalida as chaves afetadas para a tela se atualizar sozinha.
  As regras de quem pode ver o quê ficam no banco (RLS), não aqui.
*/

export const chaves = {
  disciplinas: ['disciplinas'] as const,
  topicos: ['topicos'] as const,
  estudos: ['estudos'] as const,
  perfis: ['perfis'] as const,
  convites: ['convites'] as const,
  metas: ['metas'] as const,
  provas: ['provas'] as const,
  provasFeitas: ['provasFeitas'] as const,
  materiais: ['materiais'] as const,
  cicloMetas: ['ciclo', 'metas'] as const,
  ciclo: ['ciclo', 'estado'] as const,
}

// ---------- leituras ----------

export function useDisciplinas() {
  return useQuery({
    queryKey: chaves.disciplinas,
    queryFn: () =>
      buscarTodos<Disciplina>((de, ate) =>
        supabase.from('disciplinas').select('*').order('ordem').order('criado_em').range(de, ate),
      ),
  })
}

export function useTopicos() {
  return useQuery({
    queryKey: chaves.topicos,
    queryFn: () =>
      buscarTodos<Topico>((de, ate) =>
        supabase.from('topicos').select('*').order('ordem').order('criado_em').range(de, ate),
      ),
  })
}

export function useEstudos() {
  return useQuery({
    queryKey: chaves.estudos,
    queryFn: () =>
      buscarTodos<Estudo>((de, ate) =>
        supabase.from('estudos').select('*').order('data_hora', { ascending: false }).range(de, ate),
      ),
  })
}

export function usePerfis(habilitado: boolean) {
  return useQuery({
    queryKey: chaves.perfis,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*').order('criado_em')
      if (error) throw error
      return data as Perfil[]
    },
  })
}

export function useConvites(habilitado: boolean) {
  return useQuery({
    queryKey: chaves.convites,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.from('convites').select('*').order('criado_em', { ascending: false })
      if (error) throw error
      return data as Convite[]
    },
  })
}

export function useMetas() {
  return useQuery({
    queryKey: chaves.metas,
    queryFn: async () => {
      const { data, error } = await supabase.from('metas').select('*').maybeSingle()
      if (error) throw error
      return (data as Metas | null) ?? null
    },
  })
}

export function useProvas() {
  return useQuery({
    queryKey: chaves.provas,
    queryFn: async () => {
      const { data, error } = await supabase.from('provas').select('*').order('data').order('criado_em')
      if (error) throw error
      return data as Prova[]
    },
  })
}

export function useMateriais() {
  return useQuery({
    queryKey: chaves.materiais,
    queryFn: () => buscarTodos<Material>((de, ate) => supabase.from('materiais').select('*').order('criado_em').order('id').range(de, ate)),
  })
}

export function useCicloMetas() {
  return useQuery({
    queryKey: chaves.cicloMetas,
    queryFn: () => buscarTodos<CicloMeta>((de, ate) => supabase.from('ciclo_metas').select('*').order('ordem').order('criado_em').range(de, ate)),
  })
}

export function useCiclo() {
  return useQuery({
    queryKey: chaves.ciclo,
    queryFn: async () => {
      const { data, error } = await supabase.from('ciclos').select('*').maybeSingle()
      if (error) throw error
      return (data as Ciclo | null) ?? null
    },
  })
}

// ---------- escritas ----------

function useInvalidar() {
  const qc = useQueryClient()
  return (...lista: (keyof typeof chaves)[]) => Promise.all(lista.map((k) => qc.invalidateQueries({ queryKey: chaves[k] })))
}

export function useSalvarDisciplina() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (d: { id?: string; nome: string; cor: string; ordem?: number }) => {
      const dados = { nome: d.nome.trim(), cor: d.cor, ...(d.ordem !== undefined ? { ordem: d.ordem } : {}) }
      const { error } = d.id
        ? await supabase.from('disciplinas').update(dados).eq('id', d.id)
        : await supabase.from('disciplinas').insert(dados)
      if (error) throw error
    },
    onSuccess: () => invalidar('disciplinas'),
  })
}

export function useExcluirDisciplina() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('disciplinas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('disciplinas', 'topicos', 'estudos', 'materiais'),
  })
}

export function useSalvarTopico() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (t: { id?: string; disciplina_id?: string; nome?: string; ordem?: number; nivel?: NivelTopico; concluido?: boolean }) => {
      const dados: Partial<Topico> = {}
      if (t.nome !== undefined) dados.nome = t.nome.trim()
      if (t.ordem !== undefined) dados.ordem = t.ordem
      if (t.nivel !== undefined) dados.nivel = t.nivel
      if (t.concluido !== undefined) {
        dados.concluido = t.concluido
        dados.concluido_em = t.concluido ? new Date().toISOString() : null
      }
      if (t.id) {
        const { error } = await supabase.from('topicos').update(dados).eq('id', t.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('topicos').insert({ ...dados, disciplina_id: t.disciplina_id })
        if (error) throw error
      }
    },
    onSuccess: () => invalidar('topicos'),
  })
}

/**
 * Cria um tópico novo no fim da disciplina e devolve ele já gravado (usado pelo seletor de tópico,
 * que escolhe o tópico logo depois de criar). Entra na lista em memória na hora, sem esperar recarregar.
 */
export function useCriarTopico() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ disciplina_id, nome }: { disciplina_id: string; nome: string }) => {
      const atuais = (qc.getQueryData<Topico[]>(chaves.topicos) ?? []).filter((t) => t.disciplina_id === disciplina_id)
      const ordem = atuais.reduce((m, t) => Math.max(m, t.ordem), -1) + 1
      const { data, error } = await supabase.from('topicos').insert({ disciplina_id, nome: nome.trim(), ordem, nivel: 0 }).select().single()
      if (error) throw error
      return data as Topico
    },
    onSuccess: (novo) => {
      qc.setQueryData<Topico[]>(chaves.topicos, (lista) => (lista ? [...lista, novo] : lista))
      void qc.invalidateQueries({ queryKey: chaves.topicos })
    },
  })
}

/**
 * Grava a nova ordem dos tópicos de uma disciplina (arrastar ou digitar a posição).
 * Atualiza a tela na hora (otimista) e envia tudo numa única requisição (upsert por id).
 */
export function useReordenarTopicos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ordenados: Topico[]) => {
      const linhas = ordenados.map((t, i) => ({ id: t.id, disciplina_id: t.disciplina_id, nome: t.nome, ordem: i, nivel: t.nivel }))
      const { error } = await supabase.from('topicos').upsert(linhas, { onConflict: 'id' })
      if (error) throw error
    },
    onMutate: async (ordenados) => {
      await qc.cancelQueries({ queryKey: chaves.topicos })
      const anterior = qc.getQueryData<Topico[]>(chaves.topicos)
      const novaOrdem = new Map(ordenados.map((t, i) => [t.id, { ordem: i, nivel: t.nivel }]))
      qc.setQueryData<Topico[]>(chaves.topicos, (lista) =>
        (lista ?? [])
          .map((t) => (novaOrdem.has(t.id) ? { ...t, ...novaOrdem.get(t.id)! } : t))
          .sort((a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em)),
      )
      return { anterior }
    },
    onError: (_erro, _vars, contexto) => {
      if (contexto?.anterior) qc.setQueryData(chaves.topicos, contexto.anterior)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.topicos }),
  })
}

export function useExcluirTopico() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('topicos').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => invalidar('topicos', 'estudos', 'materiais'),
  })
}

export interface ItemImportacao {
  /** id da disciplina existente, ou null para criar */
  disciplinaId: string | null
  disciplinaNome: string
  topicos: { nome: string; nivel: NivelTopico }[]
}

/** Importação em lote: cria disciplinas novas e adiciona os tópicos no fim de cada uma */
export function useImportar() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ itens, topicosExistentes, coresNovas }: { itens: ItemImportacao[]; topicosExistentes: Topico[]; coresNovas: string[] }) => {
      const novas = itens.filter((i) => !i.disciplinaId)
      const idsPorNome = new Map<string, string>()
      if (novas.length) {
        const { data, error } = await supabase
          .from('disciplinas')
          .insert(novas.map((n, i) => ({ nome: n.disciplinaNome, cor: coresNovas[i % coresNovas.length] })))
          .select('id, nome')
        if (error) throw error
        for (const d of data ?? []) idsPorNome.set(d.nome, d.id)
      }
      const linhas: { disciplina_id: string; nome: string; ordem: number; nivel: NivelTopico }[] = []
      for (const item of itens) {
        const id = item.disciplinaId ?? idsPorNome.get(item.disciplinaNome)
        if (!id) continue
        const maior = topicosExistentes.filter((t) => t.disciplina_id === id).reduce((m, t) => Math.max(m, t.ordem), -1)
        const temAnterior = topicosExistentes.some((t) => t.disciplina_id === id)
        item.topicos.forEach((t, i) => linhas.push({ disciplina_id: id, nome: t.nome, ordem: maior + 1 + i, nivel: i === 0 && !temAnterior ? 0 : t.nivel }))
      }
      for (let i = 0; i < linhas.length; i += 500) {
        const { error } = await supabase.from('topicos').insert(linhas.slice(i, i + 500))
        if (error) throw error
      }
      return { disciplinas: novas.length, topicos: linhas.length }
    },
    onSuccess: () => invalidar('disciplinas', 'topicos'),
  })
}

export function useSalvarEstudo() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, estudo, concluirTopico }: { id?: string; estudo: NovoEstudo; concluirTopico?: boolean }) => {
      let estudoId = id
      if (id) {
        const { error } = await supabase.from('estudos').update(estudo).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('estudos').insert(estudo).select('id').single()
        if (error) throw error
        estudoId = data.id as string
      }
      if (concluirTopico !== undefined && estudo.topico_id) {
        const { error: e2 } = await supabase
          .from('topicos')
          .update({ concluido: concluirTopico, concluido_em: concluirTopico ? new Date().toISOString() : null })
          .eq('id', estudo.topico_id)
        if (e2) throw e2
      }
      return estudoId
    },
    onSuccess: () => invalidar('estudos', 'topicos'),
  })
}

export function useExcluirEstudo() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('estudos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('estudos'),
  })
}

export function useConvidar() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('convites').insert({ email: email.trim().toLowerCase() })
      if (error) {
        if (error.code === '23505') throw new Error('Esse e-mail já foi convidado.')
        throw error
      }
    },
    onSuccess: () => invalidar('convites'),
  })
}

export function useCancelarConvite() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('convites').delete().eq('email', email)
      if (error) throw error
    },
    onSuccess: () => invalidar('convites'),
  })
}

export function useAlterarAtivo() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      const { error } = await supabase.from('perfis').update({ ativo }).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => invalidar('perfis'),
  })
}

export function useSalvarMetas() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ userId, minutos, questoes }: { userId: string; minutos: number | null; questoes: number | null }) => {
      const { error } = await supabase
        .from('metas')
        .upsert({ user_id: userId, minutos_semana: minutos, questoes_semana: questoes, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => invalidar('metas'),
  })
}

/** Salva nome e foto do próprio perfil. A foto nova vai para o armazenamento e a antiga é apagada. */
export function useSalvarPerfil() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ userId, nome, novaFoto, removerFoto, fotoAtual }: { userId: string; nome: string | null; novaFoto: Blob | null; removerFoto: boolean; fotoAtual: string | null }) => {
      let foto_url = fotoAtual
      if (novaFoto) {
        const caminho = `${userId}/foto-${Date.now()}.jpg`
        const { error } = await supabase.storage.from('avatares').upload(caminho, novaFoto, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
        if (error) throw new Error('Não foi possível enviar a foto. Tente de novo.')
        foto_url = supabase.storage.from('avatares').getPublicUrl(caminho).data.publicUrl
      } else if (removerFoto) {
        foto_url = null
      }
      const { error } = await supabase.from('perfis').update({ nome, foto_url }).eq('user_id', userId)
      if (error) throw error
      if (fotoAtual && fotoAtual !== foto_url) {
        const antiga = caminhoDaFoto(fotoAtual)
        if (antiga) await supabase.storage.from('avatares').remove([antiga]) // se falhar, só sobra um arquivo
      }
    },
    onSuccess: () => invalidar('perfis'),
  })
}

export function useSalvarProva() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, nome, data }: { id?: string; nome: string; data: string }) => {
      const dados = { nome: nome.trim(), data }
      const { error } = id ? await supabase.from('provas').update(dados).eq('id', id) : await supabase.from('provas').insert(dados)
      if (error) throw error
    },
    onSuccess: () => invalidar('provas'),
  })
}

export function useExcluirProva() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('provas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('provas'),
  })
}

// ---------- provas já feitas (Raio-X) ----------

export function useProvasFeitas() {
  return useQuery({
    queryKey: chaves.provasFeitas,
    queryFn: async () => {
      const { data, error } = await supabase.from('provas_feitas').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false })
      if (error) throw error
      return data as ProvaFeita[]
    },
  })
}

export function useSalvarProvaFeita() {
  const invalidar = useInvalidar()
  return useMutation({
    // só o que vier é gravado: o que o diálogo não mostra (etapas e observação de versões antigas) fica como está
    mutationFn: async ({ id, ...dados }: Partial<DadosProvaFeita> & Pick<DadosProvaFeita, 'nome' | 'data'> & { id?: string }) => {
      const { error } = id ? await supabase.from('provas_feitas').update(dados).eq('id', id) : await supabase.from('provas_feitas').insert(dados)
      if (error) throw error
    },
    onSuccess: () => invalidar('provasFeitas'),
  })
}

export function useExcluirProvaFeita() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('provas_feitas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('provasFeitas'),
  })
}

// ---------- materiais dos tópicos ----------

export function useSalvarMaterial() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, topico_id, titulo, url }: { id?: string; topico_id: string; titulo: string | null; url: string }) => {
      const { error } = id
        ? await supabase.from('materiais').update({ titulo, url }).eq('id', id)
        : await supabase.from('materiais').insert({ topico_id, titulo, url })
      if (error) throw error
    },
    onSuccess: () => invalidar('materiais'),
  })
}

export function useExcluirMaterial() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materiais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('materiais'),
  })
}

// ---------- ciclos de metas ----------

/** Grava o ciclo (sequência, posição e meta da vez); atualiza a tela na hora */
export function useSalvarCiclo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Partial<Pick<Ciclo, 'sequencia' | 'posicao' | 'meta_id'>>) => {
      const { error } = await supabase.from('ciclos').upsert({ ...c, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: chaves.ciclo })
      const anterior = qc.getQueryData<Ciclo | null>(chaves.ciclo)
      qc.setQueryData<Ciclo | null>(chaves.ciclo, (atual) => ({ user_id: '', sequencia: [], posicao: 0, meta_id: null, atualizado_em: '', ...(atual ?? {}), ...c }))
      return { anterior }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(chaves.ciclo, ctx?.anterior ?? null),
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.ciclo }),
  })
}

export function useSalvarMeta() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, ...campos }: { id: string; nome?: string; orientacoes?: string }) => {
      const { error } = await supabase.from('ciclo_metas').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('cicloMetas'),
  })
}

export interface MetaDividida {
  /** meta que já existe (mantém o id e as orientações) ou null para criar */
  metaId: string | null
  nome: string
  /** os assuntos da meta (tópicos sem subtópicos) */
  topicoIds: string[]
}

/** Divide uma disciplina em metas: cria/atualiza as metas na ordem, liga os tópicos e apaga as que sobraram */
export function useDividirMetas() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ disciplinaId, metas, existentes, semMeta = [] }: { disciplinaId: string; metas: MetaDividida[]; existentes: string[]; semMeta?: string[] }) => {
      const linhas = metas.map((m, i) => ({ id: m.metaId ?? crypto.randomUUID(), disciplina_id: disciplinaId, ordem: i, nome: m.nome.trim() || `Meta ${i + 1}` }))
      if (linhas.length) {
        const { error } = await supabase.from('ciclo_metas').upsert(linhas, { onConflict: 'id' })
        if (error) throw error
      }
      for (let i = 0; i < metas.length; i++) {
        const ids = metas[i].topicoIds
        for (let k = 0; k < ids.length; k += 200) {
          const { error } = await supabase.from('topicos').update({ meta_id: linhas[i].id }).in('id', ids.slice(k, k + 200))
          if (error) throw error
        }
      }
      if (semMeta.length) {
        const { error } = await supabase.from('topicos').update({ meta_id: null }).in('id', semMeta)
        if (error) throw error
      }
      const sobram = existentes.filter((id) => !linhas.some((l) => l.id === id))
      if (sobram.length) {
        const { error } = await supabase.from('ciclo_metas').delete().in('id', sobram)
        if (error) throw error
      }
    },
    onSuccess: () => invalidar('cicloMetas', 'topicos', 'ciclo'),
  })
}

/** Tira a divisão em metas de uma disciplina (os tópicos ficam sem meta) */
export function useApagarMetasDaDisciplina() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (disciplinaId: string) => {
      const { error } = await supabase.from('ciclo_metas').delete().eq('disciplina_id', disciplinaId)
      if (error) throw error
    },
    onSuccess: () => invalidar('cicloMetas', 'topicos', 'ciclo'),
  })
}

export function useSalvarSiglas() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (siglas: { id: string; sigla: string | null }[]) => {
      for (const s of siglas) {
        const { error } = await supabase.from('disciplinas').update({ sigla: s.sigla }).eq('id', s.id)
        if (error) throw error
      }
    },
    onSuccess: () => invalidar('disciplinas'),
  })
}
