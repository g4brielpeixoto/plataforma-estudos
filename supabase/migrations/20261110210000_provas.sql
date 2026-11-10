-- Provas/concursos de cada usuário, para a contagem regressiva da página inicial
create table public.provas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  data date not null,
  criado_em timestamptz not null default now()
);
create index provas_user_data_idx on public.provas (user_id, data);

alter table public.provas enable row level security;

create policy provas_dono on public.provas for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (user_id = (select auth.uid()) and (select privado.usuario_ativo()));

revoke all on public.provas from anon;
