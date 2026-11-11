-- Notas por disciplina de cada prova feita: lista de { nome, nota, total } (total opcional).
-- Só entram as disciplinas que a prova teve; a comparação entre provas é montada no app.
alter table public.provas_feitas
  add column disciplinas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(disciplinas) = 'array' and jsonb_array_length(disciplinas) <= 40);
