-- Tipos
create type public.papel_usuario as enum ('master', 'usuario');
create type public.origem_estudo as enum ('manual', 'cronometro', 'timer', 'pomodoro');

-- Convites: só e-mails desta lista conseguem criar conta
create table public.convites (
  email text primary key check (email = lower(trim(email)) and position('@' in email) > 1),
  papel public.papel_usuario not null default 'usuario',
  convidado_por uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);

-- Perfis: um por usuário, criado automaticamente no cadastro
create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  papel public.papel_usuario not null default 'usuario',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  cor text not null default '#8F7193',
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create index disciplinas_user_idx on public.disciplinas (user_id);

create table public.topicos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  ordem integer not null default 0,
  concluido boolean not null default false,
  concluido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index topicos_user_idx on public.topicos (user_id);
create index topicos_disciplina_idx on public.topicos (disciplina_id, ordem);

create table public.estudos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topico_id uuid not null references public.topicos(id) on delete cascade,
  data_hora timestamptz not null default now(),
  duracao_segundos integer check (duracao_segundos >= 0),
  questoes_feitas integer check (questoes_feitas >= 0),
  questoes_acertadas integer check (questoes_acertadas >= 0),
  origem public.origem_estudo not null default 'manual',
  observacao text,
  criado_em timestamptz not null default now(),
  constraint estudo_tem_conteudo check (coalesce(duracao_segundos, 0) > 0 or coalesce(questoes_feitas, 0) > 0),
  constraint acertos_validos check (
    questoes_acertadas is null
    or (questoes_feitas is not null and questoes_acertadas <= questoes_feitas)
  )
);
create index estudos_user_data_idx on public.estudos (user_id, data_hora desc);
create index estudos_topico_idx on public.estudos (topico_id);

-- Funções auxiliares usadas nas regras de acesso
create function public.usuario_ativo()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.perfis where user_id = auth.uid() and ativo) $$;

create function public.eh_master()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.perfis where user_id = auth.uid() and ativo and papel = 'master') $$;

revoke execute on function public.usuario_ativo() from public, anon;
revoke execute on function public.eh_master() from public, anon;
grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.eh_master() to authenticated;

-- Cadastro só por convite: cria o perfil ou recusa o cadastro
create function public.tratar_novo_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
begin
  select papel into v_papel
    from public.convites
   where email = lower(trim(new.email)) and usado_em is null;

  if not found then
    raise exception 'EMAIL_NAO_CONVIDADO';
  end if;

  insert into public.perfis (user_id, email, papel)
  values (new.id, lower(trim(new.email)), v_papel);

  update public.convites set usado_em = now() where email = lower(trim(new.email));
  return new;
end;
$$;
revoke execute on function public.tratar_novo_usuario() from public, anon, authenticated;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.tratar_novo_usuario();

-- Row Level Security
alter table public.convites enable row level security;
alter table public.perfis enable row level security;
alter table public.disciplinas enable row level security;
alter table public.topicos enable row level security;
alter table public.estudos enable row level security;

-- Convites: só o master vê, cria (apenas usuários comuns) e cancela pendentes
create policy convites_select on public.convites for select to authenticated
  using ((select public.eh_master()));
create policy convites_insert on public.convites for insert to authenticated
  with check ((select public.eh_master()) and papel = 'usuario' and usado_em is null);
create policy convites_delete on public.convites for delete to authenticated
  using ((select public.eh_master()) and usado_em is null);

-- Perfis: cada um vê o seu; o master vê todos e ativa/desativa usuários comuns
create policy perfis_select on public.perfis for select to authenticated
  using (user_id = (select auth.uid()) or (select public.eh_master()));
create policy perfis_update on public.perfis for update to authenticated
  using ((select public.eh_master()) and papel = 'usuario')
  with check ((select public.eh_master()) and papel = 'usuario');
revoke insert, update, delete on public.perfis from anon, authenticated;
grant update (ativo) on public.perfis to authenticated;

-- Dados de estudo: cada usuário ativo só acessa os próprios
create policy disciplinas_dono on public.disciplinas for all to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_ativo()))
  with check (user_id = (select auth.uid()) and (select public.usuario_ativo()));

create policy topicos_dono on public.topicos for all to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select public.usuario_ativo())
    and exists (select 1 from public.disciplinas d where d.id = disciplina_id and d.user_id = (select auth.uid()))
  );

create policy estudos_dono on public.estudos for all to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select public.usuario_ativo())
    and exists (select 1 from public.topicos t where t.id = topico_id and t.user_id = (select auth.uid()))
  );

revoke all on public.convites, public.perfis, public.disciplinas, public.topicos, public.estudos from anon;
