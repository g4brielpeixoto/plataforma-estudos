import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { caminhoDaFoto } from '@/lib/foto'
import { buscarTodos, supabase } from '@/lib/supabase'
import { BUCKET_FLASH, PREFIXO_IMAGENS_FLASH } from '@/lib/config'
import { camposDeNovo } from '@/lib/flashcards/agenda'
import type { CartaoImportado } from '@/lib/flashcards/anki'
import { imagensDoHtml, limparHtmlComInfo, srcPermitido } from '@/lib/flashcards/html'
import { EXTENSAO, prepararImagem } from '@/lib/flashcards/imagens'
import type { Convite, DadosProvaFeita, Disciplina, Estudo, FlashCartao, FlashConfig, FlashNota, FlashRevisao, ItemPlanner, Material, Metas, NivelTopico, NovoEstudo, Perfil, Prova, ProvaFeita, Topico } from '@/types'

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
  planner: ['planner'] as const,
  flashNotas: ['flash', 'notas'] as const,
  flashCartoes: ['flash', 'cartoes'] as const,
  flashRevisoes: ['flash', 'revisoes'] as const,
  flashConfig: ['flash', 'config'] as const,
  materiais: ['materiais'] as const,
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

export function usePlanner() {
  return useQuery({
    queryKey: chaves.planner,
    queryFn: () =>
      buscarTodos<ItemPlanner>((de, ate) =>
        supabase.from('planner_itens').select('*').order('data').order('ordem').order('criado_em').range(de, ate),
      ),
  })
}

export function useMateriais() {
  return useQuery({
    queryKey: chaves.materiais,
    queryFn: () => buscarTodos<Material>((de, ate) => supabase.from('materiais').select('*').order('criado_em').order('id').range(de, ate)),
  })
}

// revisões de flashcards: só o último ano (é o que as estatísticas usam)
const DIAS_REVISOES = 400

export function useFlashNotas() {
  return useQuery({
    queryKey: chaves.flashNotas,
    queryFn: () => buscarTodos<FlashNota>((de, ate) => supabase.from('flash_notas').select('*').order('criado_em').order('id').range(de, ate)),
  })
}

export function useFlashCartoes() {
  return useQuery({
    queryKey: chaves.flashCartoes,
    queryFn: () => buscarTodos<FlashCartao>((de, ate) => supabase.from('flash_cartoes').select('*').order('posicao').order('id').range(de, ate)),
  })
}

export function useFlashRevisoes() {
  return useQuery({
    queryKey: chaves.flashRevisoes,
    queryFn: () => {
      const desde = new Date(Date.now() - DIAS_REVISOES * 86_400_000).toISOString()
      return buscarTodos<FlashRevisao>((de, ate) =>
        supabase.from('flash_revisoes').select('*').gte('revisado_em', desde).order('revisado_em').order('id').range(de, ate),
      )
    },
  })
}

export function useFlashConfig() {
  return useQuery({
    queryKey: chaves.flashConfig,
    queryFn: async () => {
      const { data, error } = await supabase.from('flash_config').select('*').maybeSingle()
      if (error) throw error
      return (data as FlashConfig | null) ?? null
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
    onSuccess: () => invalidar('disciplinas', 'topicos', 'estudos', 'planner', 'flashNotas', 'flashCartoes', 'flashRevisoes', 'materiais'),
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
    onSuccess: () => invalidar('topicos', 'estudos', 'planner', 'flashNotas', 'materiais'),
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
    mutationFn: async ({ id, estudo, concluirTopico, plannerItemId }: { id?: string; estudo: NovoEstudo; concluirTopico?: boolean; plannerItemId?: string }) => {
      let estudoId = id
      if (id) {
        const { error } = await supabase.from('estudos').update(estudo).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('estudos').insert(estudo).select('id').single()
        if (error) throw error
        estudoId = data.id as string
      }
      // estudo que veio do planner: o item fica concluído e ligado a este registro
      if (plannerItemId && estudoId) {
        const { error: e3 } = await supabase.from('planner_itens').update({ concluido_em: new Date().toISOString(), estudo_id: estudoId }).eq('id', plannerItemId)
        if (e3) throw e3
      }
      if (concluirTopico !== undefined) {
        const { error: e2 } = await supabase
          .from('topicos')
          .update({ concluido: concluirTopico, concluido_em: concluirTopico ? new Date().toISOString() : null })
          .eq('id', estudo.topico_id)
        if (e2) throw e2
      }
      return estudoId
    },
    onSuccess: () => invalidar('estudos', 'topicos', 'planner'),
  })
}

export function useExcluirEstudo() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('estudos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('estudos', 'planner'),
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

// ---------- planner ----------

export type DadosItemPlanner = Pick<ItemPlanner, 'data' | 'disciplina_id' | 'topico_id' | 'tipo' | 'minutos_previstos' | 'observacao'>

export function useSalvarItemPlanner() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosItemPlanner & { ordem?: number; adiamentos?: number } }) => {
      const { error } = id
        ? await supabase.from('planner_itens').update(dados).eq('id', id)
        : await supabase.from('planner_itens').insert({ ...dados, data_original: dados.data, ordem: dados.ordem ?? 0 })
      if (error) throw error
    },
    onSuccess: () => invalidar('planner'),
  })
}

export function useExcluirItemPlanner() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planner_itens').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar('planner'),
  })
}

/** Grava vários itens de uma vez (mover de dia, reagendar atrasados), atualizando a tela na hora */
export function useAtualizarItensPlanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itens: ItemPlanner[]) => {
      if (!itens.length) return
      const linhas = itens.map(({ user_id: _u, criado_em: _c, ...resto }) => resto)
      const { error } = await supabase.from('planner_itens').upsert(linhas, { onConflict: 'id' })
      if (error) throw error
    },
    onMutate: async (itens) => {
      await qc.cancelQueries({ queryKey: chaves.planner })
      const anterior = qc.getQueryData<ItemPlanner[]>(chaves.planner)
      const novos = new Map(itens.map((i) => [i.id, i]))
      qc.setQueryData<ItemPlanner[]>(chaves.planner, (lista) => (lista ?? []).map((i) => novos.get(i.id) ?? i))
      return { anterior }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.planner, ctx.anterior)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.planner }),
  })
}

/** Desfaz o check: o item volta a pendente e o estudo que ele gerou sai do histórico */
export function useDesmarcarItemPlanner() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (item: ItemPlanner) => {
      const { error } = await supabase.from('planner_itens').update({ concluido_em: null, estudo_id: null }).eq('id', item.id)
      if (error) throw error
      if (item.estudo_id) {
        const { error: e2 } = await supabase.from('estudos').delete().eq('id', item.estudo_id)
        if (e2) throw e2
      }
    },
    onSuccess: () => invalidar('planner', 'estudos'),
  })
}

// ---------- flashcards ----------

export type DadosNotaFlash = Pick<FlashNota, 'disciplina_id' | 'topico_id' | 'tipo' | 'frente' | 'verso'>

function* lotes<T>(lista: T[], tamanho: number) {
  for (let i = 0; i < lista.length; i += tamanho) yield lista.slice(i, i + tamanho)
}

/** Cria ou edita uma nota e acerta os cartões dela (um por número de omissão; um só no básico) */
export function useSalvarNotaFlash() {
  const invalidar = useInvalidar()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados, ordens, posicao }: { id?: string; dados: DadosNotaFlash; ordens: number[]; posicao: number }) => {
      const anterior = id ? qc.getQueryData<FlashNota[]>(chaves.flashNotas)?.find((n) => n.id === id) : undefined
      const novoCartao = (notaId: string, ordem: number) => ({ nota_id: notaId, ordem, posicao, suspenso: false, ...camposDeNovo() })
      if (!id) {
        const notaId = crypto.randomUUID()
        const { error } = await supabase.from('flash_notas').insert({ id: notaId, ...dados })
        if (error) throw error
        const { error: e2 } = await supabase.from('flash_cartoes').insert(ordens.map((o) => novoCartao(notaId, o)))
        if (e2) {
          await supabase.from('flash_notas').delete().eq('id', notaId)
          throw e2
        }
        return notaId
      }
      const { error } = await supabase.from('flash_notas').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      const { data: atuais, error: e2 } = await supabase.from('flash_cartoes').select('id, ordem').eq('nota_id', id)
      if (e2) throw e2
      const existentes = (atuais ?? []) as { id: string; ordem: number }[]
      const faltam = ordens.filter((o) => !existentes.some((a) => a.ordem === o))
      const sobram = existentes.filter((a) => !ordens.includes(a.ordem)).map((a) => a.id)
      if (faltam.length) {
        const { error: e3 } = await supabase.from('flash_cartoes').insert(faltam.map((o) => novoCartao(id, o)))
        if (e3) throw e3
      }
      if (sobram.length) {
        const { error: e4 } = await supabase.from('flash_cartoes').delete().in('id', sobram)
        if (e4) throw e4
      }
      if (anterior) {
        const restantes = (qc.getQueryData<FlashNota[]>(chaves.flashNotas) ?? []).map((n) => (n.id === id ? { ...n, ...dados } : n))
        await apagarImagensSemUso(imagensDoHtml(anterior.frente + anterior.verso), restantes)
      }
      return id
    },
    onSuccess: () => invalidar('flashNotas', 'flashCartoes', 'flashRevisoes'),
  })
}

export function useExcluirNotasFlash() {
  const invalidar = useInvalidar()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const todas = qc.getQueryData<FlashNota[]>(chaves.flashNotas) ?? []
      const apagar = new Set(ids)
      for (const lote of lotes(ids, 200)) {
        const { error } = await supabase.from('flash_notas').delete().in('id', lote)
        if (error) throw error
      }
      const saem = todas.filter((n) => apagar.has(n.id)).flatMap((n) => imagensDoHtml(n.frente + n.verso))
      await apagarImagensSemUso(saem, todas.filter((n) => !apagar.has(n.id)))
    },
    onSuccess: () => invalidar('flashNotas', 'flashCartoes', 'flashRevisoes'),
  })
}

/** Muda vários cartões de uma vez (suspender, reativar, esquecer) */
export function useAtualizarCartoesFlash() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ ids, campos }: { ids: string[]; campos: Partial<Omit<FlashCartao, 'id' | 'user_id' | 'nota_id'>> }) => {
      for (const lote of lotes(ids, 200)) {
        const { error } = await supabase.from('flash_cartoes').update(campos).in('id', lote)
        if (error) throw error
      }
    },
    onSuccess: () => invalidar('flashCartoes'),
  })
}

export function useSalvarFlashConfig() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (c: Pick<FlashConfig, 'novos_por_dia' | 'revisoes_por_dia' | 'retencao'>) => {
      const { error } = await supabase.from('flash_config').upsert({ ...c, atualizado_em: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => invalidar('flashConfig'),
  })
}

type CamposResposta = Omit<FlashCartao, 'user_id' | 'nota_id' | 'ordem' | 'suspenso' | 'posicao' | 'criado_em'>
const camposDaAgenda = ({ id: _id, ...c }: FlashCartao): Omit<CamposResposta, 'id'> => ({
  estado: c.estado,
  vence_em: c.vence_em,
  estabilidade: c.estabilidade,
  dificuldade: c.dificuldade,
  dias_agendados: c.dias_agendados,
  passo: c.passo,
  repeticoes: c.repeticoes,
  lapsos: c.lapsos,
  ultima_revisao: c.ultima_revisao,
})

/**
  Resposta na sessão de revisão: grava o novo agendamento e o registro da revisão.
  Atualiza o cache na hora e não recarrega tudo a cada cartão.
*/
export function useResponderFlash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cartao, revisao }: { cartao: FlashCartao; revisao: Omit<FlashRevisao, 'user_id'> }) => {
      const { error } = await supabase.from('flash_cartoes').update(camposDaAgenda(cartao)).eq('id', cartao.id)
      if (error) throw error
      const { error: e2 } = await supabase.from('flash_revisoes').insert(revisao)
      if (e2) throw e2
    },
    onMutate: ({ cartao, revisao }) => {
      qc.setQueryData<FlashCartao[]>(chaves.flashCartoes, (l) => l?.map((c) => (c.id === cartao.id ? cartao : c)))
      qc.setQueryData<FlashRevisao[]>(chaves.flashRevisoes, (l) => (l ? [...l, { ...revisao, user_id: '' }] : l))
    },
  })
}

/** Desfaz a última resposta: volta o agendamento anterior e apaga o registro da revisão */
export function useDesfazerFlash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ anterior, revisaoId }: { anterior: FlashCartao; revisaoId: string }) => {
      const { error } = await supabase.from('flash_revisoes').delete().eq('id', revisaoId)
      if (error) throw error
      const { error: e2 } = await supabase.from('flash_cartoes').update(camposDaAgenda(anterior)).eq('id', anterior.id)
      if (e2) throw e2
    },
    onMutate: ({ anterior, revisaoId }) => {
      qc.setQueryData<FlashCartao[]>(chaves.flashCartoes, (l) => l?.map((c) => (c.id === anterior.id ? anterior : c)))
      qc.setQueryData<FlashRevisao[]>(chaves.flashRevisoes, (l) => l?.filter((r) => r.id !== revisaoId))
    },
  })
}

/** Envia uma imagem de flashcard (já reduzida se precisar) e devolve o endereço público */
export async function enviarImagemFlash(arquivo: Blob): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Sua sessão expirou. Entre de novo para enviar imagens.')
  const { blob, tipo } = await prepararImagem(arquivo)
  const caminho = `${uid}/${crypto.randomUUID()}.${EXTENSAO[tipo] ?? 'img'}`
  const { error } = await supabase.storage.from(BUCKET_FLASH).upload(caminho, blob, { contentType: tipo, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET_FLASH).getPublicUrl(caminho).data.publicUrl
}

/** Apaga do bucket as imagens que nenhuma das notas restantes usa (falhar aqui só deixa um arquivo sobrando) */
async function apagarImagensSemUso(candidatas: string[], restantes: Pick<FlashNota, 'frente' | 'verso'>[]) {
  if (!candidatas.length) return
  const usadas = new Set(restantes.flatMap((n) => imagensDoHtml(n.frente + n.verso)))
  const caminhos = [...new Set(candidatas)].filter((u) => u.startsWith(PREFIXO_IMAGENS_FLASH) && !usadas.has(u)).map((u) => u.slice(PREFIXO_IMAGENS_FLASH.length))
  if (caminhos.length) await supabase.storage.from(BUCKET_FLASH).remove(caminhos)
}

export interface NotaParaImportar {
  id: string
  origem: string
  /** disciplina existente, ou o nome de uma disciplina nova (em `novasDisciplinas`) */
  disciplinaId: string | null
  novaDisciplina: string | null
  topicoId: string | null
  tipo: FlashNota['tipo']
  /** HTML com as imagens do pacote ainda como "anki-midia:NOME" */
  frente: string
  verso: string
  cartoes: CartaoImportado[]
}

export interface PlanoImportacaoFlash {
  novasDisciplinas: { nome: string; cor: string; ordem: number }[]
  notas: NotaParaImportar[]
  /** notas importadas antes sem as imagens: recebem o conteúdo de novo, agora com elas */
  completar: { nota: FlashNota; frente: string; verso: string }[]
  /** imagens do pacote usadas pelas notas acima */
  midias: string[]
  lerMidias: (nomes: string[]) => Promise<Map<string, Blob>>
}

export interface ProgressoImportacao {
  fase: 'imagens' | 'notas'
  feitas: number
  total: number
}

/** Grava a importação do Anki: imagens, disciplinas novas e depois notas e cartões em lotes */
export function useImportarFlashcards() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ plano, aoProgredir }: { plano: PlanoImportacaoFlash; aoProgredir?: (p: ProgressoImportacao) => void }) => {
      // 1. imagens: lê do pacote em blocos e envia 4 por vez
      const enderecos = new Map<string, string>()
      let imagensComFalha = 0
      const PREFIXO = 'anki-midia:'
      for (let i = 0; i < plano.midias.length; i += 40) {
        const bloco = plano.midias.slice(i, i + 40)
        const blobs = await plano.lerMidias(bloco)
        for (let j = 0; j < bloco.length; j += 4) {
          await Promise.all(
            bloco.slice(j, j + 4).map(async (nome) => {
              const blob = blobs.get(nome)
              if (!blob) return void imagensComFalha++
              try {
                enderecos.set(nome, await enviarImagemFlash(blob))
              } catch {
                imagensComFalha++
              }
            }),
          )
          aoProgredir?.({ fase: 'imagens', feitas: Math.min(plano.midias.length, i + j + 4), total: plano.midias.length })
        }
      }
      const resolver = (html: string) =>
        limparHtmlComInfo(html, (src) => (src.startsWith(PREFIXO) ? (enderecos.get(decodeURIComponent(src.slice(PREFIXO.length))) ?? null) : srcPermitido(src))).html

      // 2. notas já importadas que tinham ficado sem as imagens
      for (const lote of lotes(plano.completar, 200)) {
        const linhas = lote.map(({ nota, frente, verso }) => ({
          id: nota.id,
          disciplina_id: nota.disciplina_id,
          topico_id: nota.topico_id,
          tipo: nota.tipo,
          origem_anki: nota.origem_anki,
          frente: resolver(frente),
          verso: resolver(verso),
          atualizado_em: new Date().toISOString(),
        }))
        const { error } = await supabase.from('flash_notas').upsert(linhas, { onConflict: 'id' })
        if (error) throw error
      }

      // 3. disciplinas novas
      const idsNovas = new Map<string, string>()
      if (plano.novasDisciplinas.length) {
        const { data, error } = await supabase.from('disciplinas').insert(plano.novasDisciplinas).select('id, nome')
        if (error) throw error
        for (const d of data as { id: string; nome: string }[]) idsNovas.set(d.nome, d.id)
      }
      const total = plano.notas.length
      let feitas = 0
      let cartoes = 0
      aoProgredir?.({ fase: 'notas', feitas: 0, total })
      // lotes de até 400 notas ou ~300 KB de texto
      const grupos: NotaParaImportar[][] = []
      let atual: NotaParaImportar[] = []
      let tamanho = 0
      for (const n of plano.notas) {
        const t = n.frente.length + n.verso.length + 200
        if (atual.length && (atual.length >= 400 || tamanho + t > 300_000)) {
          grupos.push(atual)
          atual = []
          tamanho = 0
        }
        atual.push(n)
        tamanho += t
      }
      if (atual.length) grupos.push(atual)

      for (const grupo of grupos) {
        const linhasNotas = grupo.map((n) => ({
          id: n.id,
          disciplina_id: n.disciplinaId ?? idsNovas.get(n.novaDisciplina ?? '') ?? '',
          topico_id: n.topicoId,
          tipo: n.tipo,
          frente: resolver(n.frente),
          verso: resolver(n.verso),
          origem_anki: n.origem,
        }))
        const { error } = await supabase.from('flash_notas').insert(linhasNotas)
        if (error) throw error
        const linhasCartoes = grupo.flatMap((n) =>
          n.cartoes.map((c) => ({ nota_id: n.id, ordem: c.ordem, suspenso: c.suspenso, posicao: c.posicao, ...(c.agenda ?? camposDeNovo()) })),
        )
        for (const lote of lotes(linhasCartoes, 1000)) {
          const { error: e2 } = await supabase.from('flash_cartoes').insert(lote)
          if (e2) {
            // não deixa nota sem cartão: desfaz o lote inteiro
            await supabase.from('flash_notas').delete().in('id', grupo.map((n) => n.id))
            throw e2
          }
        }
        feitas += grupo.length
        cartoes += linhasCartoes.length
        aoProgredir?.({ fase: 'notas', feitas, total })
      }
      return { notas: feitas, cartoes, disciplinasNovas: idsNovas.size, imagens: enderecos.size, imagensComFalha, completadas: plano.completar.length }
    },
    onSettled: () => invalidar('disciplinas', 'flashNotas', 'flashCartoes'),
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
