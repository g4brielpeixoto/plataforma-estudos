-- Define o e-mail do usuário master (quem administra a plataforma e convida as outras pessoas).
-- Rode uma única vez no SQL Editor do Supabase, trocando o e-mail abaixo.
-- Depois, a pessoa entra no site, clica em "Criar conta" e se cadastra com esse e-mail.
insert into public.convites (email, papel)
values (lower(trim('EMAIL_DO_MASTER@exemplo.com')), 'master')
on conflict (email) do update set papel = 'master';
