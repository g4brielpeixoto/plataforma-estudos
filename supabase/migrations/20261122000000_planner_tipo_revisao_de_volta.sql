-- O tipo "revisao" volta ao planner: agora quem cria é o "Programar revisões" do Salvar estudo
-- (revisões em N dias escolhidos pelo usuário), não mais a revisão automática pelo acerto.
alter table public.planner_itens drop constraint planner_itens_tipo_check;
alter table public.planner_itens add constraint planner_itens_tipo_check check (tipo in ('estudo', 'resumo', 'exercicios', 'revisao'));
