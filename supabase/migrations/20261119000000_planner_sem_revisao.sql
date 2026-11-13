-- O tipo "revisao" saiu do planner (a revisão pelo acerto foi retirada do app).
-- O que ainda estiver como revisão vira exercícios, e o tipo deixa de ser aceito.
update public.planner_itens set tipo = 'exercicios' where tipo = 'revisao';
alter table public.planner_itens drop constraint planner_itens_tipo_check;
alter table public.planner_itens add constraint planner_itens_tipo_check check (tipo in ('estudo', 'resumo', 'exercicios'));
