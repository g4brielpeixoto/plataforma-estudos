-- Provas que o usuário já fez (Raio-X): notas e notas de corte da objetiva, da discursiva e a final.
-- Fica separada de `provas`, que é só a contagem regressiva do Início; por isso os campos de
-- resultado criados em 20261115000000_provas_resultado.sql saem de lá (nunca foram usados).
alter table public.provas
  drop constraint provas_nota_ate_maxima,
  drop column cargo,
  drop column banca,
  drop column nota,
  drop column nota_corte,
  drop column nota_maxima,
  drop column situacao,
  drop column classificacao,
  drop column observacao;

create table public.provas_feitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  cargo text check (cargo is null or char_length(cargo) <= 120),
  banca text check (banca is null or char_length(banca) <= 80),
  data date not null,
  nota_objetiva numeric(8, 2) check (nota_objetiva is null or nota_objetiva >= 0),
  corte_objetiva numeric(8, 2) check (corte_objetiva is null or corte_objetiva >= 0),
  nota_discursiva numeric(8, 2) check (nota_discursiva is null or nota_discursiva >= 0),
  corte_discursiva numeric(8, 2) check (corte_discursiva is null or corte_discursiva >= 0),
  nota_final numeric(8, 2) check (nota_final is null or nota_final >= 0),
  corte_final numeric(8, 2) check (corte_final is null or corte_final >= 0),
  situacao text check (situacao is null or situacao in ('aprovado', 'classificado', 'nao_classificado', 'eliminado', 'aguardando')),
  classificacao integer check (classificacao is null or classificacao > 0),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  criado_em timestamptz not null default now()
);
create index provas_feitas_user_data_idx on public.provas_feitas (user_id, data);

alter table public.provas_feitas enable row level security;

create policy provas_feitas_dono on public.provas_feitas for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (user_id = (select auth.uid()) and (select privado.usuario_ativo()));

revoke all on public.provas_feitas from anon;
