-- Materiais dos tópicos: links (texto próprio, PDF, vídeo…) que abrem em outra aba
create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topico_id uuid not null references public.topicos(id) on delete cascade,
  titulo text check (titulo is null or char_length(titulo) between 1 and 120),
  -- só http(s): nada de javascript: ou data:
  url text not null check (char_length(url) <= 2000 and url ~* '^https?://[^[:space:]]+$'),
  criado_em timestamptz not null default now()
);
create index materiais_user_idx on public.materiais (user_id);
create index materiais_topico_idx on public.materiais (topico_id);

alter table public.materiais enable row level security;

create policy materiais_dono on public.materiais for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.topicos t where t.id = topico_id and t.user_id = (select auth.uid()))
  );

revoke all on public.materiais from anon;
