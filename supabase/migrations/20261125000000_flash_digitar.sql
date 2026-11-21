-- Cartão "Digitar a resposta": frente e verso, e na revisão a pessoa digita a resposta (comparada com o verso)
alter table public.flash_notas drop constraint flash_notas_tipo_check;
alter table public.flash_notas add constraint flash_notas_tipo_check check (tipo in ('basico', 'omissao', 'digitar'));
