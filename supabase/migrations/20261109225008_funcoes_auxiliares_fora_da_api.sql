-- Tira as funções auxiliares do schema exposto pela API (public),
-- para que não possam ser chamadas via /rest/v1/rpc. As políticas continuam funcionando.
create schema if not exists privado;
grant usage on schema privado to authenticated;
alter function public.usuario_ativo() set schema privado;
alter function public.eh_master() set schema privado;
alter function public.tratar_novo_usuario() set schema privado;
