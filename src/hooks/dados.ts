import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { caminhoDaFoto } from '@/lib/foto'
import { buscarTodos, supabase } from '@/lib/supabase'
import type { Convite, Disciplina, Estudo, Metas, NivelTopico, NovoEstudo, Perfil, Topico } from '@/types'

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
    onSuccess: () => invalidar('disciplinas', 'topicos', 'estudos'),
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
    onSuccess: () => invalidar('topicos', 'estudos'),
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
      const { error } = id
        ? await supabase.from('estudos').update(estudo).eq('id', id)
        : await supabase.from('estudos').insert(estudo)
      if (error) throw error
      if (concluirTopico !== undefined) {
        const { error: e2 } = await supabase
          .from('topicos')
          .update({ concluido: concluirTopico, concluido_em: concluirTopico ? new Date().toISOString() : null })
          .eq('id', estudo.topico_id)
        if (e2) throw e2
      }
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
