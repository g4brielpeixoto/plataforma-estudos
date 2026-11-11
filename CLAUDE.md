# Plataforma de Estudos — guia para o Claude Code

App pessoal e multiusuário para acompanhar estudos de concurso: edital (disciplinas → tópicos com check de concluído), registro de estudos (tempo e questões), planner (dia/semana/mês), flashcards no estilo do Anki, cronômetro/timer/pomodoro, histórico e dashboard. Interface e código em **português**.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, React Router (`createHashRouter`), TanStack Query, Recharts, lucide-react, sonner (toasts), date-fns (locale `ptBR`), Radix Dialog, dnd-kit (arrastar tópicos e itens do planner entre os dias), ts-fsrs (agendamento dos flashcards). Só na importação do Anki, carregados sob demanda: fflate (zip), fzstd (zstd) e sql.js (SQLite em WASM).
- **Backend:** Supabase (Postgres + Auth + API REST automática). Não existe servidor próprio: toda regra de acesso está no banco (RLS).
- **Deploy:** GitHub Actions → GitHub Pages a cada push na `main` (`.github/workflows/deploy.yml`). `base: './'` + rotas em hash, então funciona em qualquer subcaminho.

## Comandos

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b + vite build (rode antes de commitar)
npx oxlint src   # lint
```

## Estrutura

```
src/
  App.tsx                 rotas + guardas (AreaLogada, SoMaster)
  contexts/AuthContext.tsx sessão, perfil, login/cadastro/recuperação; traduz erros do Supabase
  hooks/dados.ts          TODAS as leituras/escritas no Supabase (React Query). Mutations invalidam as chaves.
  hooks/useCronometro.ts  cronômetro/timer/pomodoro; tempo derivado de Date.now(), estado no localStorage
  lib/indicadores.ts      cálculo dos 3 indicadores, filtro de período, resumo por tópico
  lib/importacao.ts       parser da importação em lote (# = disciplina, linha = tópico)
  lib/constancia.ts       dias estudados (≥ 20 min), sequência, faixas do mapa de calor, semana atual
  lib/versiculos.ts       lista de versículos (Almeida Revista e Corrigida); o do dia muda à meia-noite de Brasília (America/Sao_Paulo), igual para todos
  lib/config.ts           URL e chave publicável do Supabase (com override por env) e o bucket/prefixo das imagens dos flashcards
  lib/supabase.ts         cliente + buscarTodos (paginação)
  components/ui.tsx       componentes base (Botao, Entrada, EntradaSenha, Selecao, Interruptor, Dialogo, Confirmar, Painel, SeloAcerto…)
  components/ListaTopicos.tsx  lista de tópicos com colunas Questões, Último estudo e Estudo (no tópico pai os números somam os subtópicos); a alça de arrastar e o número editável só aparecem no modo "Editar ordem"
  components/Materiais.tsx     etiquetas de material (links) e o diálogo de materiais do tópico
  components/SeletorTopico.tsx campo de tópico com busca (abre uma janela; digita parte do nome ou o número do edital; setas + Enter). Usado em Estudar, Salvar estudo, Planner e Flashcards
  lib/buscaTopicos.ts     regras da busca de tópico: cada palavra bate com o nome ou com a numeração ("4" acha 4, 4.1, 4.2…; número no nome só inteiro) — testadas
  lib/materiais.ts        links dos materiais: normaliza (https:// na frente), tipo (pdf/vídeo/documento/link) e nome para mostrar
  lib/foto.ts             prepara a foto de perfil (recorte quadrado 320px JPEG), iniciais, primeiro nome
  components/Avatar.tsx   foto redonda ou iniciais
  lib/planner.ts          regras do planner: datas sem fuso, atrasados, mover/reagendar (contagem de adiamentos), semanas do mês — testadas com casos de borda
  hooks/usePlannerAcoes.tsx  ações de um item (check, play, mover, editar, excluir) e os diálogos que elas abrem; quem usa renderiza `dialogos`
  components/CartaoPlanner.tsx  cartão do item (variante "coluna" da semana e "largo" do dia/Início), check, menu ⋮
  components/PlannerItemDialog.tsx  criar/editar item do planner
  components/PlanejamentoHoje.tsx   card "Planejamento de hoje" do Início
  lib/flashcards/         html.ts (limpeza do HTML dos cartões), omissao.ts ({{c1::…}}), agenda.ts (FSRS), fila.ts (fila e limites do dia), estatisticas.ts, anki.ts (leitura de .apkg/.colpkg/.txt, com imagens), imagens.ts (reduz/converte antes de enviar) — testados com casos de borda e com arquivos reais do Anki
  hooks/useFlash.ts       dados dos flashcards já cruzados (nota de cada cartão, baralho, limites, feitos hoje)
  components/flashcards/  CampoRico (editor com Omissão), NotaFlashDialog, ImportarAnkiDialog, ConfigFlashDialog, ConteudoCartao
  pages/                  Acesso (login/cadastro/esqueci/redefinir), Inicio, Edital, Disciplina, Planner, Flashcards, BaralhoFlash, RevisaoFlash, Estudar, Historico, RaioX, Perfil, Usuarios
supabase/migrations/      SQL versionado (já aplicado no projeto de produção)
supabase/definir-master.sql  define o e-mail do master
```

## Banco (Supabase, projeto `qudoenqafdaayrdnxkel`, região sa-east-1)

Tabelas em `public`: `perfis`, `convites`, `disciplinas`, `topicos`, `estudos`, `metas` (metas semanais de minutos e questões, uma linha por usuário), `provas` (nome e data de cada prova/concurso), `planner_itens` (itens do planner), `materiais` (links de material de cada tópico), `flash_notas`, `flash_cartoes`, `flash_revisoes`, `flash_config` (flashcards). Funções auxiliares em `privado` (fora da API).

- **Cadastro só por convite:** trigger `privado.tratar_novo_usuario` em `auth.users` recusa e-mails fora de `convites` (o Supabase devolve "Database error saving new user", traduzido no front) e cria o `perfil` com o papel do convite.
- **Master:** único que vê/cria/cancela convites e ativa/desativa usuários comuns. Não consegue criar outro master pelo app (só via SQL).
- **Usuário desativado** (`perfis.ativo = false`) perde acesso a todos os dados pelo RLS.
- **Perfil:** `perfis.nome` e `perfis.foto_url`, editáveis pelo próprio usuário (policy `perfis_update_proprio` + grant só nessas colunas e em `ativo`). O trigger `privado.proteger_ativo` impede mudar `ativo` sem ser master e o master de mudar o próprio. Fotos no bucket público `avatares`, pasta `<user_id>/`, 2 MB, jpeg/png/webp; a foto antiga é apagada ao trocar.
- `user_id` tem default `auth.uid()`: **não envie user_id** nos inserts.
- Estudo precisa de tempo > 0 ou questões > 0; acertos ≤ feitas (constraints no banco).
- `planner_itens`: `data` (dia atual do item) e `data_original` (dia em que foi planejado), `tipo` (estudo/revisao/resumo/exercicios), `topico_id` opcional, `minutos_previstos`, `observacao` (≤ 500), `ordem` no dia, `adiamentos`, `concluido_em`, `estudo_id` (o estudo que o concluiu; `on delete set null`). A policy só aceita disciplina, tópico (da mesma disciplina) e estudo do próprio usuário.
- **Flashcards:** `flash_notas` (conteúdo; `disciplina_id` = baralho, `topico_id` opcional, `tipo` basico/omissao, `frente`/`verso` em HTML simples, `origem_anki` única por usuário para não duplicar importações); `flash_cartoes` (um por nota no básico, `ordem` 0; um por número de omissão; campos do FSRS: `estado` 0 novo/1 aprendendo/2 revisão/3 reaprendendo, `vence_em`, `estabilidade`, `dificuldade`, `dias_agendados`, `passo`, `repeticoes`, `lapsos`, `ultima_revisao`, `suspenso`, `posicao`); `flash_revisoes` (cada resposta 1–4, estado antes, duração); `flash_config` (novos/dia, revisões/dia, retenção). Apagar a disciplina apaga tudo em cascata.
- **Imagens dos flashcards:** bucket público `flashcards` (5 MB, jpeg/png/webp/gif), pasta `<user_id>/`, nome aleatório; só o dono com conta ativa envia/troca/apaga. No HTML do cartão a imagem é `<img src="<URL pública>">`; `limparHtml` só aceita src que começa com `PREFIXO_IMAGENS_FLASH` (o resto vira "[imagem]"). Ao excluir uma nota ou tirar a imagem de uma nota, o arquivo é apagado se nenhuma outra nota usar (apagar a disciplina inteira deixa os arquivos).
- **Materiais:** `materiais` (`topico_id`, `titulo` opcional ≤ 120, `url` só http/https sem espaços, ≤ 2000). Apagar o tópico apaga os materiais.
- Mudanças de schema: crie um novo arquivo em `supabase/migrations/` e aplique no projeto (MCP do Supabase ou SQL Editor). Depois rode os advisors de segurança.

## Regras de negócio

- **Tempo de estudo** = soma de `duracao_segundos` no período. **Desempenho** = acertadas ÷ feitas no período. **Progresso no edital** = tópicos `concluido` ÷ total (não depende do período).
- **Saudação:** "Bom dia/Boa tarde/Boa noite, <primeiro nome>!" (hora do aparelho); sem nome, mostra link para o perfil. O avatar não aparece no Início (já está no topo do celular e na barra lateral).
- **Escolher tópico:** `SeletorTopico` sem disciplina escolhida busca em todas, agrupando por disciplina; escolher um tópico de outra disciplina troca a disciplina. A janela abre por cima de outro diálogo (`Dialogo` com `sobreposto`), com foco na busca (`focoInicial`) e, no celular, colada no topo (`noTopo`) para o teclado não cobrir a lista.
- **Provas:** card de contagem regressiva no Início com as provas de hoje em diante (mais próxima primeiro); com mais de uma, alterna a cada 6 s com animação (pausa com mouse/foco; sem troca automática se o sistema pede menos movimento). Cadastro no diálogo da engrenagem (`ProvasDialog`). Datas `date` sem fuso: use `lib/provas.ts`.
- **Início (layout):** linha de 4 resumos (`ResumoTopo`: tempo total, desempenho, progresso no edital — cada um com "Neste mês" e variação contra o mesmo trecho do mês passado — e o versículo); faixa larga de Constância (quadradinho por dia, ≥ 20 min = ✓, navegação por janelas; "Ver detalhes" leva ao Raio-X); depois 2 colunas no xl: esquerda Planejamento de hoje (itens do dia com check e play, aviso de atrasados), Estudo semanal (barras seg–dom, Tempo/Questões, navega semanas) e o atalho do Raio-X; direita Provas, Metas semanais e Tempo de estudo (pizza). No celular a ordem é Planejamento, Provas, Metas, Estudo semanal, Tempo de estudo, Raio-X (classes `order-*` com as colunas em `contents`).
- **Raio-X** (`/raio-x`, página `RaioX`): a análise detalhada da aprendizagem, fora do Início: Heatmap do ano (`MapaCalor`), Por disciplina (`PorDisciplina`: tempo, questões, acerto, progresso no edital) e Pontos de atenção (`PontosAtencao`: até 8 tópicos com menor acerto, com ≥ 5 questões e < 80%, e até 8 em andamento parados há 3 dias ou mais). No menu lateral fica depois de Histórico; no celular, como ícone no topo (a barra de baixo comporta 6 itens). Heatmap: 0: < 20 min, 1: < 1h, 2: < 2h, 3: < 4h, 4: ≥ 4h. Períodos em `lib/periodos.ts`.
- **Planner** (`/planner`): visões Dia, Semana (padrão, segunda a domingo, colunas com cabeçalho escuro; hoje em destaque) e Mês (clicar no dia abre a visão Dia); a escolha fica salva no navegador. Cores por tipo + verde para feito e vermelho para atrasado, com legenda. Arrastar um cartão para outro dia o move (no toque: segurar e arrastar); o menu ⋮ também move (hoje/amanhã/próxima segunda), edita e exclui.
  - **Check:** abre o diálogo de estudo já preenchido (disciplina, tópico, tempo previsto); ao salvar, o estudo entra no histórico e o item fica concluído com `estudo_id`. "Só marcar como feito" conclui sem registrar. Desmarcar um item com estudo ligado pede confirmação e apaga esse estudo.
  - **Play:** vai para Estudar com `state.planner` e começa a contar com a disciplina/tópico do item (`plannerId` no estado do cronômetro). Ao salvar, o item é concluído. Se já houver tempo de outro estudo no relógio, avisa e não troca.
  - **Atrasados:** item pendente com `data` antes de hoje. Fica vermelho no dia e aparece na caixa "Atrasados" (Hoje / Amanhã / Próx. semana / Reagendar todos: a partir de hoje ou amanhã, N por dia). Mover um item pendente de hoje ou do passado para um dia à frente soma 1 em `adiamentos` (mostrado como "adiado N×"); reorganizar o futuro não conta. Nada é movido sozinho.
  - Mover vários itens usa `useAtualizarItensPlanner` (upsert com atualização otimista).
- **Salvar estudo** (`EstudoDialog`): interruptor "Salvar e criar novo" (preferência salva no navegador, `estudo:criar-novo`). Ligado, ao salvar o diálogo continua aberto, mostra o que foi salvo e abre um registro em branco mantendo disciplina e dia; tempo do cronômetro e item do planner valem só para o primeiro registro. Observação com contador de 500 caracteres.
- **Flashcards** (`/flashcards`, `/flashcards/:id`, revisão em tela cheia fora do Layout em `/flashcards/estudar/:escopo` com `escopo` = id da disciplina ou `todos` e `?topico=`):
  - Agendamento FSRS (ts-fsrs) com passos do Anki: aprendizado 1 min e 10 min, reaprendizado 10 min, retenção padrão 90%. Botões Errei/Difícil/Bom/Fácil mostram o próximo intervalo. Atalhos: espaço/enter mostra a resposta e depois vale "Bom", 1–4, Ctrl+Z desfaz, E edita.
  - Fila (`lib/flashcards/fila.ts`): aprendizado vencido primeiro; depois revisões do dia e novos intercalados, com limite diário por baralho (o que já foi feito hoje desconta); sem mais nada, aprendizado que vence em até 20 min é antecipado. Dia = dia do aparelho.
  - A sessão trabalha numa cópia dos cartões e grava cada resposta em fila (update do cartão + insert da revisão, com id gerado no app), sem recarregar tudo; ao sair, invalida os dados. Desfazer volta o cartão e apaga a revisão.
  - Editor (`CampoRico`): imagem pelo botão, colando (print da tela) ou arrastando; o "Salvar" espera o envio terminar.
  - Omissão: `{{cN::texto}}` ou `{{cN::texto::dica}}`; editar a nota cria/apaga os cartões conforme os números. HTML sempre limpo por `limparHtml` (só tags simples, sem atributos) ao salvar, importar, colar e de novo ao exibir.
  - Importação do Anki (`lib/flashcards/anki.ts`, roda no navegador): .apkg/.colpkg nos formatos novo (`collection.anki21b`, zstd, esquema 18) e antigo (`collection.anki21`/`.anki2`), e .txt de notas em texto puro. Baralho "A::B" sugere disciplina A e tópico B (ignorando a numeração do edital). Mantém o progresso: revisões viram estado 2 com o mesmo vencimento e intervalo; estabilidade/dificuldade do FSRS do Anki quando existem, senão aproximadas (estabilidade = intervalo; dificuldade pelo fator de facilidade). Aprendendo no Anki entra como novo. Imagens do pacote (índice "media": JSON no formato antigo; protobuf + zstd no novo, arquivos também em zstd) ficam como `anki-midia:NOME` até a gravação, que envia cada uma (4 por vez, reduzidas a 1600 px/WebP quando grandes ou em formato não aceito) e troca pelo endereço. Notas importadas antes, que ficaram com "[imagem]", recebem as imagens ao importar o mesmo arquivo de novo (só se ainda tiverem o "[imagem]"). Imagens citadas mas ausentes do pacote (ou vindas de .txt) viram "[imagem]", com aviso. Cartões invertidos ficam de fora (aviso na tela). Já importadas (mesmo guid; no .txt sem guid, mesma frente) são puladas. Grava em lotes; se um lote falhar, desfaz as notas daquele lote.
  - Estatísticas próprias (não entram no histórico nem no tempo de estudo): para hoje, revisados hoje, acerto, sequência de dias, revisões em 30 dias, cartões por estado (jovem < 21 dias ≤ maduro) e previsão de 7 dias.
- Faixas de acerto: ≥ 80% verde, 60–79% amarelo, < 60% vermelho (`nivelAcerto` em `lib/utils.ts`).
- Pomodoro: só o tempo de foco conta como estudo; ao fim de cada fase o relógio para e espera o usuário.
- **Subtópicos (até 3 níveis):** `topicos.nivel` (0 tópico, 1 subtópico, 2 subtópico do subtópico). A lista da disciplina é única e ordenada; cada item pertence ao item acima com um nível a menos. Regras em `lib/topicos.ts` (numeração 4 / 4.2 / 4.2.1, usada também nas listas de escolha de tópico via `rotuloSelecao(t, todos)`; arrastar leva a subárvore; recuar/avançar; posição digitada é entre os irmãos) — testadas com casos de borda. Seta para recolher/expandir, salva no navegador por disciplina. Nos números do item pai entram todos os subtópicos. Importação: cada recuo maior (espaços ou tab) desce um nível.
- **Ordenar tópicos só no modo de edição:** na página da disciplina, o botão "Editar ordem" (canto direito da linha dos filtros; no celular só "Editar") liga o modo em que aparecem a alça de arrastar e o número editável, e muda o filtro para Todos; "Concluir" desliga. Fora dele o número é só texto, para não mudar a ordem sem querer. O modo não fica salvo.
- **Materiais do tópico:** no menu ⋮ de cada tópico, "Adicionar material" / "Materiais (N)" abre o diálogo para colar um link (PDF, texto próprio, vídeo, Drive…) com nome opcional; dá para editar e remover. Os links aparecem como etiquetas embaixo do nome do tópico (até 3, depois "+N") e na tela Estudar quando o tópico está escolhido; abrem em outra aba com `rel="noopener noreferrer"`.
- Ordem dos tópicos: `useReordenarTopicos` grava a lista inteira numa só requisição (upsert por `id`, `ordem` = posição) com atualização otimista.
- Os dados são carregados inteiros por usuário (`buscarTodos`) e agregados no front. Escala pessoal, funciona bem até dezenas de milhares de estudos.

## Visual

Paleta lilás definida em `src/index.css` como variáveis CSS (`--c-*`) e exposta ao Tailwind (`bg-primaria`, `text-tinta`, `bg-nevoa`…). Tema escuro via classe `.dark` no `<html>`. Planner: `--c-estudo`, `--c-revisao`, `--c-resumo`, `--c-exercicios` (e `-fundo`), `--c-cabecalho` (cabeçalho escuro dos dias). Fontes: Figtree (interface) e Literata (títulos e versículo). Use os tokens, nunca cores soltas.

Largura: o conteúdo ocupa toda a tela ao lado do menu (o `<main>` do `Layout` não tem `max-w`); só formulários e o relógio limitam a própria largura (Perfil, Estudar, revisão dos flashcards, visão Dia do planner). Para telas muito largas existe o breakpoint `3xl` (112rem), usado no grid do Edital; o heatmap aumenta os quadradinhos até 28 px para preencher a largura.

## Convenções

- Nomes de variáveis, componentes e textos em português; textos curtos, voz ativa, sentence case.
- Erros mostrados ao usuário dizem o que aconteceu e como resolver.
- Sempre `npm run build` sem erros antes de commitar.
- Grids sempre com `grid-cols-1` (ou `minmax(0,…)`) na base, para conteúdo longo não estourar a largura no celular.
