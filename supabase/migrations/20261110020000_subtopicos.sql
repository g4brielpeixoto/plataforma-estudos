-- Subtópicos: nível 1 = subtópico do tópico de nível 0 que vem logo antes na ordem da disciplina
alter table public.topicos
  add column nivel smallint not null default 0 check (nivel in (0, 1));
