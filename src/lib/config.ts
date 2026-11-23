// Endereço e chave publicável do Supabase. A chave é pública por natureza: a proteção dos dados
// é feita pelas regras de Row Level Security no banco (ver supabase/migrations).
// O "?." permite usar este arquivo fora do Vite (testes com tsx), onde import.meta.env não existe.
export const URL_SUPABASE: string = import.meta.env?.VITE_SUPABASE_URL || 'https://qudoenqafdaayrdnxkel.supabase.co'
export const CHAVE_SUPABASE: string = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_S5fSeBKEr-NIkDHGkAcXug_apPkLqWy'

