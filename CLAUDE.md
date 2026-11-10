# Plataforma de Estudos — guia para o Claude Code

App pessoal e multiusuário para acompanhar estudos de concurso: edital (disciplinas → tópicos com check de concluído), registro de estudos (tempo e questões), cronômetro/timer/pomodoro, histórico e dashboard. Interface e código em **português**.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, React Router (`createHashRouter`), TanStack Query, Recharts, lucide-react, sonner (toasts), date-fns (locale `ptBR`), Radix Dialog, dnd-kit (arrastar tópicos).
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
  lib/supabase.ts         cliente (URL e chave publicável fixas, com override por env) + buscarTodos (paginação)
  components/ui.tsx       componentes base (Botao, Entrada, EntradaSenha, Selecao, Dialogo, Confirmar, Painel, SeloAcerto…)
  components/ListaTopicos.tsx  lista de tópicos ordenável (arrastar ou digitar a posição) com colunas Questões, Último estudo e Estudo; no tópico pai os números somam os subtópicos
  lib/foto.ts             prepara a foto de perfil (recorte quadrado 320px JPEG), iniciais, primeiro nome
  components/Avatar.tsx   foto redonda ou iniciais
  pages/                  Acesso (login/cadastro/esqueci/redefinir), Inicio, Edital, Disciplina, Estudar, Historico, Perfil, Usuarios
supabase/migrations/      SQL versionado (já aplicado no projeto de produção)
supabase/definir-master.sql  define o e-mail do master
```

## Banco (Supabase, projeto `qudoenqafdaayrdnxkel`, região sa-east-1)

Tabelas em `public`: `perfis`, `convites`, `disciplinas`, `topicos`, `estudos`, `metas` (metas semanais de minutos e questões, uma linha por usuário), `provas` (nome e data de cada prova/concurso). Funções auxiliares em `privado` (fora da API).

- **Cadastro só por convite:** trigger `privado.tratar_novo_usuario` em `auth.users` recusa e-mails fora de `convites` (o Supabase devolve "Database error saving new user", traduzido no front) e cria o `perfil` com o papel do convite.
- **Master:** único que vê/cria/cancela convites e ativa/desativa usuários comuns. Não consegue criar outro master pelo app (só via SQL).
- **Usuário desativado** (`perfis.ativo = false`) perde acesso a todos os dados pelo RLS.
- **Perfil:** `perfis.nome` e `perfis.foto_url`, editáveis pelo próprio usuário (policy `perfis_update_proprio` + grant só nessas colunas e em `ativo`). O trigger `privado.proteger_ativo` impede mudar `ativo` sem ser master e o master de mudar o próprio. Fotos no bucket público `avatares`, pasta `<user_id>/`, 2 MB, jpeg/png/webp; a foto antiga é apagada ao trocar.
- `user_id` tem default `auth.uid()`: **não envie user_id** nos inserts.
- Estudo precisa de tempo > 0 ou questões > 0; acertos ≤ feitas (constraints no banco).
- Mudanças de schema: crie um novo arquivo em `supabase/migrations/` e aplique no projeto (MCP do Supabase ou SQL Editor). Depois rode os advisors de segurança.

## Regras de negócio

- **Tempo de estudo** = soma de `duracao_segundos` no período. **Desempenho** = acertadas ÷ feitas no período. **Progresso no edital** = tópicos `concluido` ÷ total (não depende do período).
- **Saudação:** "Bom dia/Boa tarde/Boa noite, <primeiro nome>!" (hora do aparelho); sem nome, mostra link para o perfil.
- **Provas:** card de contagem regressiva no Início com as provas de hoje em diante (mais próxima primeiro); com mais de uma, alterna a cada 6 s com animação (pausa com mouse/foco; sem troca automática se o sistema pede menos movimento). Cadastro no diálogo da engrenagem (`ProvasDialog`). Datas `date` sem fuso: use `lib/provas.ts`.
- **Início (layout):** linha de 4 resumos (`ResumoTopo`: tempo total, desempenho, progresso no edital — cada um com "Neste mês" e variação contra o mesmo trecho do mês passado — e o versículo); faixa larga de Constância (quadradinho por dia, ≥ 20 min = ✓, navegação por janelas); depois 2 colunas no xl: esquerda Heatmap, Por disciplina, Pontos de atenção; direita Provas, Metas semanais, Estudo semanal (barras seg–dom, Tempo/Questões, navega semanas) e Tempo de estudo (pizza). No celular a coluna da direita vem primeiro. Heatmap: 0: < 20 min, 1: < 1h, 2: < 2h, 3: < 4h, 4: ≥ 4h. Períodos em `lib/periodos.ts`.
- Faixas de acerto: ≥ 80% verde, 60–79% amarelo, < 60% vermelho (`nivelAcerto` em `lib/utils.ts`).
- Pomodoro: só o tempo de foco conta como estudo; ao fim de cada fase o relógio para e espera o usuário.
- **Subtópicos (até 3 níveis):** `topicos.nivel` (0 tópico, 1 subtópico, 2 subtópico do subtópico). A lista da disciplina é única e ordenada; cada item pertence ao item acima com um nível a menos. Regras em `lib/topicos.ts` (numeração 4 / 4.2 / 4.2.1; arrastar leva a subárvore; recuar/avançar; posição digitada é entre os irmãos) — testadas com casos de borda. Seta para recolher/expandir, salva no navegador por disciplina. Nos números do item pai entram todos os subtópicos. Importação: cada recuo maior (espaços ou tab) desce um nível.
- Ordem dos tópicos: `useReordenarTopicos` grava a lista inteira numa só requisição (upsert por `id`, `ordem` = posição) com atualização otimista.
- Os dados são carregados inteiros por usuário (`buscarTodos`) e agregados no front. Escala pessoal, funciona bem até dezenas de milhares de estudos.

## Visual

Paleta lilás definida em `src/index.css` como variáveis CSS (`--c-*`) e exposta ao Tailwind (`bg-primaria`, `text-tinta`, `bg-nevoa`…). Tema escuro via classe `.dark` no `<html>`. Fontes: Figtree (interface) e Literata (títulos e versículo). Use os tokens, nunca cores soltas.

## Convenções

- Nomes de variáveis, componentes e textos em português; textos curtos, voz ativa, sentence case.
- Erros mostrados ao usuário dizem o que aconteceu e como resolver.
- Sempre `npm run build` sem erros antes de commitar.
- Grids sempre com `grid-cols-1` (ou `minmax(0,…)`) na base, para conteúdo longo não estourar a largura no celular.
