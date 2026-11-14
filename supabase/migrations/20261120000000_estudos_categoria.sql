-- Categoria do estudo (Teoria, Questões, Revisão, Flashcards ou outra que o usuário criar). Opcional.
alter table public.estudos add column categoria text check (categoria is null or char_length(categoria) between 1 and 40);
