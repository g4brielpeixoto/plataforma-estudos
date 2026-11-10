-- Planner: o que a pessoa planeja estudar em cada dia
create table public.planner_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  -- dia em que foi planejado pela primeira vez (para saber quanto já foi adiado)
  data_original date not null,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  topico_id uuid references public.topicos(id) on delete set null,
  tipo text not null default 'estudo' check (tipo in ('estudo', 'revisao', 'resumo', 'exercicios')),
  minutos_previstos integer check (minutos_previstos is null or minutos_previstos between 1 and 1440),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  ordem integer not null default 0,
  adiamentos integer not null default 0 check (adiamentos >= 0),
  concluido_em timestamptz,
  -- estudo registrado no histórico ao concluir
  estudo_id uuid references public.estudos(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index planner_itens_user_data_idx on public.planner_itens (user_id, data);
create index planner_itens_disciplina_idx on public.planner_itens (disciplina_id);
create index planner_itens_topico_idx on public.planner_itens (topico_id);
create index planner_itens_estudo_idx on public.planner_itens (estudo_id);

alter table public.planner_itens enable row level security;

create policy planner_itens_dono on public.planner_itens for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.disciplinas d where d.id = disciplina_id and d.user_id = (select auth.uid()))
    and (topico_id is null or exists (
      select 1 from public.topicos t where t.id = topico_id and t.user_id = (select auth.uid()) and t.disciplina_id = planner_itens.disciplina_id))
    and (estudo_id is null or exists (select 1 from public.estudos e where e.id = estudo_id and e.user_id = (select auth.uid())))
  );

revoke all on public.planner_itens from anon;
