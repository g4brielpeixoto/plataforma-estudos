-- Ciclos de metas: cada disciplina é dividida em metas (grupos de tópicos seguidos do edital) e o ciclo
-- é a ordem em que as disciplinas se revezam (uma disciplina pode aparecer mais de uma vez).

create table public.ciclo_metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  ordem integer not null check (ordem >= 0),
  nome text not null check (char_length(trim(nome)) between 1 and 200),
  orientacoes text not null default '' check (char_length(orientacoes) <= 4000),
  criado_em timestamptz not null default now()
);
create index ciclo_metas_user_idx on public.ciclo_metas (user_id);
create index ciclo_metas_disciplina_idx on public.ciclo_metas (disciplina_id, ordem);

alter table public.ciclo_metas enable row level security;
create policy ciclo_metas_dono on public.ciclo_metas for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.disciplinas d where d.id = disciplina_id and d.user_id = (select auth.uid()))
  );

-- cada tópico pertence a no máximo uma meta (da mesma disciplina)
alter table public.topicos add column meta_id uuid references public.ciclo_metas(id) on delete set null;
create index topicos_meta_idx on public.topicos (meta_id);

create or replace function privado.topico_meta_valida() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.meta_id is not null and not exists (
    select 1 from public.ciclo_metas m
    where m.id = new.meta_id and m.user_id = new.user_id and m.disciplina_id = new.disciplina_id
  ) then
    raise exception 'A meta precisa ser da mesma disciplina do tópico.';
  end if;
  return new;
end $$;

create trigger topico_meta_valida before insert or update of meta_id, disciplina_id on public.topicos
  for each row execute function privado.topico_meta_valida();

-- sigla curta da disciplina (DC, PORT…) para o quadro e a roda do ciclo
alter table public.disciplinas add column sigla text check (sigla is null or char_length(trim(sigla)) between 1 and 8);

-- o ciclo de cada usuário: sequência de disciplinas, posição atual e a meta da vez
create table public.ciclos (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sequencia uuid[] not null default '{}' check (cardinality(sequencia) <= 60),
  posicao integer not null default 0 check (posicao >= 0),
  meta_id uuid references public.ciclo_metas(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

alter table public.ciclos enable row level security;
create policy ciclos_dono on public.ciclos for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and (meta_id is null or exists (select 1 from public.ciclo_metas m where m.id = meta_id and m.user_id = (select auth.uid())))
  );
