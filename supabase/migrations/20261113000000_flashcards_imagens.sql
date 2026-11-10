-- Imagens dos flashcards: bucket público (o link tem nome aleatório), pasta = id do usuário.
-- Só o dono, com a conta ativa, envia, troca ou apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flashcards', 'flashcards', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy flashcards_ler_proprias on storage.objects for select to authenticated
  using (bucket_id = 'flashcards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy flashcards_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'flashcards' and (storage.foldername(name))[1] = (select auth.uid())::text and (select privado.usuario_ativo()));
create policy flashcards_atualizar on storage.objects for update to authenticated
  using (bucket_id = 'flashcards' and (storage.foldername(name))[1] = (select auth.uid())::text and (select privado.usuario_ativo()));
create policy flashcards_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'flashcards' and (storage.foldername(name))[1] = (select auth.uid())::text);
