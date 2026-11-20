-- Leis: mapeamento dos artigos mais cobrados, com anotações em tópicos encaixados (estilo RemNote)
create table public.leis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- a disciplina dá a cor e é o baralho dos flashcards criados na lei
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  criado_em timestamptz not null default now()
);
create index leis_user_idx on public.leis (user_id);
create index leis_disciplina_idx on public.leis (disciplina_id);

alter table public.leis enable row level security;
create policy leis_dono on public.leis for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.disciplinas d where d.id = disciplina_id and d.user_id = (select auth.uid()))
  );
revoke all on public.leis from anon;

-- Linhas da lei: lista única e ordenada; cada linha pertence à linha acima com um nível a menos
create table public.lei_linhas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lei_id uuid not null references public.leis(id) on delete cascade,
  ordem integer not null default 0,
  nivel smallint not null default 0 check (nivel between 0 and 5),
  -- HTML simples, já limpo no app (negrito, cor, grifo…)
  texto text not null default '' check (char_length(texto) <= 20000),
  -- o quanto o artigo é cobrado; com incidência a linha conta como "artigo mapeado"
  incidencia text check (incidencia in ('alta', 'media', 'baixa')),
  revisado_em timestamptz,
  -- o flashcard criado a partir desta linha
  nota_id uuid references public.flash_notas(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index lei_linhas_user_idx on public.lei_linhas (user_id);
create index lei_linhas_lei_idx on public.lei_linhas (lei_id, ordem);
create index lei_linhas_nota_idx on public.lei_linhas (nota_id) where nota_id is not null;

alter table public.lei_linhas enable row level security;
create policy lei_linhas_dono on public.lei_linhas for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.leis l where l.id = lei_id and l.user_id = (select auth.uid()))
    and (nota_id is null or exists (select 1 from public.flash_notas n where n.id = nota_id and n.user_id = (select auth.uid())))
  );
revoke all on public.lei_linhas from anon;
