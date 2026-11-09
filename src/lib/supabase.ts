import { createClient } from '@supabase/supabase-js'

// A chave publicável é pública por natureza: a proteção dos dados é feita
// pelas regras de Row Level Security no banco (ver supabase/migrations).
const URL_PADRAO = 'https://qudoenqafdaayrdnxkel.supabase.co'
const CHAVE_PADRAO = 'sb_publishable_S5fSeBKEr-NIkDHGkAcXug_apPkLqWy'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || URL_PADRAO,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || CHAVE_PADRAO,
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
