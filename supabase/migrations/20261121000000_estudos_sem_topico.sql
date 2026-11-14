-- Estudo sem tópico (ex.: sessão de flashcards da disciplina): o estudo passa a guardar a disciplina
-- e o tópico vira opcional. Com tópico, a disciplina é sempre a do tópico (trigger), então clientes
-- antigos que só mandam o tópico continuam funcionando.
alter table public.estudos add column disciplina_id uuid references public.disciplinas(id) on delete cascade;
update public.estudos e set disciplina_id = t.disciplina_id from public.topicos t where t.id = e.topico_id;
alter table public.estudos alter column disciplina_id set not null;
alter table public.estudos alter column topico_id drop not null;
create index estudos_disciplina_idx on public.estudos (disciplina_id);

create function privado.estudo_disciplina_do_topico() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.topico_id is not null then
    select t.disciplina_id into new.disciplina_id from public.topicos t where t.id = new.topico_id;
  end if;
  return new;
end $$;
revoke all on function privado.estudo_disciplina_do_topico() from public, anon, authenticated;

create trigger estudos_disciplina_do_topico before insert or update of topico_id, disciplina_id on public.estudos
for each row execute function privado.estudo_disciplina_do_topico();

drop policy estudos_dono on public.estudos;
create policy estudos_dono on public.estudos for all to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (
    user_id = (select auth.uid()) and (select privado.usuario_ativo())
    and exists (select 1 from public.disciplinas d where d.id = estudos.disciplina_id and d.user_id = (select auth.uid()))
    and (topico_id is null or exists (select 1 from public.topicos t where t.id = estudos.topico_id and t.user_id = (select auth.uid()) and t.disciplina_id = estudos.disciplina_id))
  );
