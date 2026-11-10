-- Flashcards no estilo do Anki
-- nota = o conteúdo (frente/verso ou texto com omissões); cartão = o que é revisado (uma nota de omissão gera um cartão por número {{c1::}}, {{c2::}}…)

create table public.flash_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- o baralho é a disciplina; o tópico é opcional
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  topico_id uuid references public.topicos(id) on delete set null,
  tipo text not null check (tipo in ('basico', 'omissao')),
  -- básico: pergunta; omissão: texto com {{c1::…}}. HTML simples (negrito, itálico, listas), já limpo no app
  frente text not null check (char_length(frente) between 1 and 20000),
  -- básico: resposta; omissão: texto extra mostrado no verso
  verso text not null default '' check (char_length(verso) <= 20000),
  -- id da nota no Anki, para não duplicar ao importar o mesmo arquivo de novo
  origem_anki text check (origem_anki is null or char_length(origem_anki) <= 60),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, origem_anki)
);
create index flash_notas_user_idx on public.flash_notas (user_id);
create index flash_notas_disciplina_idx on public.flash_notas (disciplina_id);
create index flash_notas_topico_idx on public.flash_notas (topico_id);

create table public.flash_cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nota_id uuid not null references public.flash_notas(id) on delete cascade,
  -- 0 no básico; número da omissão (1, 2…) na omissão
  ordem smallint not null default 0 check (ordem between 0 and 500),
  -- agendamento FSRS: 0 novo, 1 aprendendo, 2 revisão, 3 reaprendendo
  estado smallint not null default 0 check (estado between 0 and 3),
  vence_em timestamptz not null default now(),
  estabilidade double precision not null default 0 check (estabilidade >= 0),
  dificuldade double precision not null default 0 check (dificuldade between 0 and 10),
  dias_agendados integer not null default 0 check (dias_agendados >= 0),
  passo smallint not null default 0 check (passo >= 0),
  repeticoes integer not null default 0 check (repeticoes >= 0),
  lapsos integer not null default 0 check (lapsos >= 0),
  ultima_revisao timestamptz,
  suspenso boolean not null default false,
  -- ordem em que os cartões novos aparecem
  posicao integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (nota_id, ordem)
);
create index flash_cartoes_user_vence_idx on public.flash_cartoes (user_id, vence_em);

create table public.flash_revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cartao_id uuid not null references public.flash_cartoes(id) on delete cascade,
  -- 1 errei, 2 difícil, 3 bom, 4 fácil
  resposta smallint not null check (resposta between 1 and 4),
  estado_antes smallint not null check (estado_antes between 0 and 3),
  dias_agendados integer not null default 0 check (dias_agendados >= 0),
  duracao_ms integer not null default 0 check (duracao_ms between 0 and 3600000),
  revisado_em timestamptz not null default now()
);
create index flash_revisoes_user_data_idx on public.flash_revisoes (user_id, revisado_em);
create index flash_revisoes_cartao_idx on public.flash_revisoes (cartao_id);

-- limites diários e retenção desejada (uma linha por usuário)
create table public.flash_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  novos_por_dia integer not null default 20 check (novos_por_dia between 0 and 9999),
  revisoes_por_dia integer not null default 200 check (revisoes_por_dia between 0 and 99999),
  retencao numeric(3, 2) not null default 0.90 check (retencao between 0.70 and 0.99),
  atualizado_em timestamptz not null default now()
);

alter table public.flash_notas enable row level security;
alter table public.flash_cartoes enable row level security;
alter table public.flash_revisoes enable row level security;
alter table public.flash_config enable row level security;

create policy flash_notas_dono on public.flash_notas for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.disciplinas d where d.id = disciplina_id and d.user_id = (select auth.uid()))
    and (topico_id is null or exists (
      select 1 from public.topicos t where t.id = topico_id and t.user_id = (select auth.uid()) and t.disciplina_id = flash_notas.disciplina_id))
  );

create policy flash_cartoes_dono on public.flash_cartoes for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.flash_notas n where n.id = nota_id and n.user_id = (select auth.uid()))
  );

create policy flash_revisoes_dono on public.flash_revisoes for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.flash_cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );

create policy flash_config_dono on public.flash_config for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (user_id = (select auth.uid()) and (select privado.usuario_ativo()));

revoke all on public.flash_notas, public.flash_cartoes, public.flash_revisoes, public.flash_config from anon;
