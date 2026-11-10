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
  lib/versiculos.ts       lista de versículos (Almeida Revista e Corrigida) do card da página inicial
  lib/supabase.ts         cliente (URL e chave publicável fixas, com override por env) + buscarTodos (paginação)
  components/ui.tsx       componentes base (Botao, Entrada, EntradaSenha, Selecao, Dialogo, Confirmar, Painel, SeloAcerto…)
  components/ListaTopicos.tsx  lista de tópicos ordenável: arrastar pela alça ou tocar no número e digitar a posição
  pages/                  Acesso (login/cadastro/esqueci/redefinir), Inicio, Edital, Disciplina, Estudar, Historico, Usuarios
supabase/migrations/      SQL versionado (já aplicado no projeto de produção)
supabase/definir-master.sql  define o e-mail do master
```

## Banco (Supabase, projeto `qudoenqafdaayrdnxkel`, região sa-east-1)

Tabelas em `public`: `perfis`, `convites`, `disciplinas`, `topicos`, `estudos`, `metas` (metas semanais de minutos e questões, uma linha por usuário). Funções auxiliares em `privado` (fora da API).

- **Cadastro só por convite:** trigger `privado.tratar_novo_usuario` em `auth.users` recusa e-mails fora de `convites` (o Supabase devolve "Database error saving new user", traduzido no front) e cria o `perfil` com o papel do convite.
- **Master:** único que vê/cria/cancela convites e ativa/desativa usuários comuns. Não consegue criar outro master pelo app (só via SQL).
- **Usuário desativado** (`perfis.ativo = false`) perde acesso a todos os dados pelo RLS.
- `user_id` tem default `auth.uid()`: **não envie user_id** nos inserts.
- Estudo precisa de tempo > 0 ou questões > 0; acertos ≤ feitas (constraints no banco).
- Mudanças de schema: crie um novo arquivo em `supabase/migrations/` e aplique no projeto (MCP do Supabase ou SQL Editor). Depois rode os advisors de segurança.

## Regras de negócio

- **Tempo de estudo** = soma de `duracao_segundos` no período. **Desempenho** = acertadas ÷ feitas no período. **Progresso no edital** = tópicos `concluido` ÷ total (não depende do período).
- **Início:** Tempo de estudo (pizza por disciplina: hoje/semana/mês/total, comparação com o mesmo trecho do período anterior), Metas semanais (segunda a domingo), Constância (dias seguidos com ≥ 20 min), Heatmap dos últimos 12 meses (0: < 20 min, 1: < 1h, 2: < 2h, 3: < 4h, 4: ≥ 4h).
- Faixas de acerto: ≥ 80% verde, 60–79% amarelo, < 60% vermelho (`nivelAcerto` em `lib/utils.ts`).
- Pomodoro: só o tempo de foco conta como estudo; ao fim de cada fase o relógio para e espera o usuário.
- **Subtópicos:** `topicos.nivel` (0 tópico, 1 subtópico). A lista da disciplina é única e ordenada; um subtópico pertence ao tópico de nível 0 logo acima. Regras em `lib/topicos.ts` (blocos, numeração 2 / 2.1, arrastar tópico leva os subtópicos, posição digitada do subtópico é entre os irmãos). Importação: linha começando com tab ou 2+ espaços vira subtópico.
- Ordem dos tópicos: `useReordenarTopicos` grava a lista inteira numa só requisição (upsert por `id`, `ordem` = posição) com atualização otimista.
- Os dados são carregados inteiros por usuário (`buscarTodos`) e agregados no front. Escala pessoal, funciona bem até dezenas de milhares de estudos.

## Visual

Paleta lilás definida em `src/index.css` como variáveis CSS (`--c-*`) e exposta ao Tailwind (`bg-primaria`, `text-tinta`, `bg-nevoa`…). Tema escuro via classe `.dark` no `<html>`. Fontes: Figtree (interface) e Literata (títulos e versículo). Use os tokens, nunca cores soltas.

## Convenções

- Nomes de variáveis, componentes e textos em português; textos curtos, voz ativa, sentence case.
- Erros mostrados ao usuário dizem o que aconteceu e como resolver.
- Sempre `npm run build` sem erros antes de commitar.
- Grids sempre com `grid-cols-1` (ou `minmax(0,…)`) na base, para conteúdo longo não estourar a largura no celular.
