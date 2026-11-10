-- Metas semanais de cada usuário (horas e questões), definidas por ele mesmo
create table public.metas (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  minutos_semana integer check (minutos_semana is null or minutos_semana between 1 and 10080),
  questoes_semana integer check (questoes_semana is null or questoes_semana between 1 and 100000),
  atualizado_em timestamptz not null default now()
);

alter table public.metas enable row level security;

create policy metas_dono on public.metas for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (user_id = (select auth.uid()) and (select privado.usuario_ativo()));

revoke all on public.metas from anon;
