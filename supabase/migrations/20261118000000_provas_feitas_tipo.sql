-- Simulados usam a mesma tabela das provas feitas (mesmos campos e mesmas regras de acesso);
-- `tipo` separa as duas listas do Raio-X. O que já existia é prova.
alter table public.provas_feitas
  add column tipo text not null default 'prova' check (tipo in ('prova', 'simulado'));
