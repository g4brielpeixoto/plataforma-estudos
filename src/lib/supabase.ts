import { createClient } from '@supabase/supabase-js'
import { CHAVE_SUPABASE, URL_SUPABASE } from './config'

export const supabase = createClient(
  URL_SUPABASE,
  CHAVE_SUPABASE,
  {
    auth: {
      // PKCE devolve ?code= na URL, o que convive bem com as rotas em hash (#/...)
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/** Busca todas as linhas de uma consulta, paginando de 1000 em 1000 (limite da API). */
export async function buscarTodos<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const tamanho = 1000
  const todos: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await consulta(de, de + tamanho - 1)
    if (error) throw error
    todos.push(...(data ?? []))
    if (!data || data.length < tamanho) break
  }
  return todos
}
