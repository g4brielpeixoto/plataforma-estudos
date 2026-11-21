-- Menu Leis retirado a pedido da usuária: apaga as tabelas (as linhas vão junto).
-- Os flashcards criados a partir das linhas ficam em flash_notas (a ligação era só lei_linhas.nota_id).
drop table if exists public.lei_linhas;
drop table if exists public.leis;
