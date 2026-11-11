-- Resultado das provas já feitas: nota, nota de corte, situação e dados do concurso.
-- Tudo opcional, para a prova continuar podendo ser cadastrada só com nome e data (contagem regressiva).
alter table public.provas
  add column cargo text check (cargo is null or char_length(cargo) <= 120),
  add column banca text check (banca is null or char_length(banca) <= 80),
  add column nota numeric(8, 2) check (nota is null or nota >= 0),
  add column nota_corte numeric(8, 2) check (nota_corte is null or nota_corte >= 0),
  add column nota_maxima numeric(8, 2) check (nota_maxima is null or nota_maxima > 0),
  add column situacao text check (situacao is null or situacao in ('aprovado', 'classificado', 'nao_classificado', 'eliminado', 'aguardando')),
  add column classificacao integer check (classificacao is null or classificacao > 0),
  add column observacao text check (observacao is null or char_length(observacao) <= 500),
  add constraint provas_nota_ate_maxima check (nota is null or nota_maxima is null or nota <= nota_maxima);
