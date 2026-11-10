-- Terceiro nível: 0 = tópico, 1 = subtópico, 2 = subtópico do subtópico
alter table public.topicos drop constraint topicos_nivel_check;
alter table public.topicos add constraint topicos_nivel_check check (nivel between 0 and 2);
