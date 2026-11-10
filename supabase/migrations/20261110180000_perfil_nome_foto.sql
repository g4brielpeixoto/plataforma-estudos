-- Nome e foto de cada usuário, editáveis por ele mesmo
alter table public.perfis
  add column nome text check (nome is null or char_length(nome) between 1 and 80),
  add column foto_url text check (foto_url is null or char_length(foto_url) <= 500);

grant update (nome, foto_url) on public.perfis to authenticated;

-- cada usuário ativo pode editar o próprio perfil
create policy perfis_update_proprio on public.perfis for update to authenticated
  using (user_id = (select auth.uid()) and (select privado.usuario_ativo()))
  with check (user_id = (select auth.uid()));

-- só o master muda o "ativo", e nunca o do próprio perfil
create function privado.proteger_ativo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.ativo is distinct from old.ativo
     and (not privado.eh_master() or old.user_id = auth.uid()) then
    raise exception 'Sem permissão para alterar o status desta conta';
  end if;
  return new;
end;
$$;
revoke execute on function privado.proteger_ativo() from public, anon, authenticated;

create trigger proteger_ativo
  before update on public.perfis
  for each row execute function privado.proteger_ativo();

-- fotos de perfil: leitura pública pelo link; cada um só mexe na própria pasta (<user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatares_ler_proprios on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_atualizar on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
