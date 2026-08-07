# Axon V4 — Frontend Profissional

Versão vendável do Axon (Dez/2026). Frontend novo, profissional, consumindo a
mesma API V2 (FastAPI) — o backend NÃO é reescrito.

## Stack

- React 18 + TypeScript (strict)
- Vite (build/DEV)
- Tailwind CSS (design system)
- shadcn/ui (componentes acessíveis e profissionais)
- TanStack Query (dados/cache/polling inteligente)
- Zustand (estado global)
- React Router (lazy loading por rota)

## Estrutura de pastas

```
v4/
├── referencias-design/       # Exemplos de sites e system designs para definir a identidade
│   ├── sites/                # Screenshots/links de referência visual
│   └── system-designs/       # Docs de design systems (cores, tipografia, tokens)
├── src/
│   ├── app/                  # Setup: providers, router, layout raiz, tela de loading
│   ├── components/           # UI compartilhada (shadcn + componentes próprios)
│   │   └── ui/               # Componentes base (button, table, dialog, toast...)
│   ├── features/             # UM DIRETÓRIO POR MÓDULO DE NEGÓCIO
│   │   ├── documentos/       # NF-e, NFS-e, relatórios, eventos
│   │   ├── chat/             # Chat interno + IA de atendimento
│   │   ├── dashboard/        # Métricas e visão geral
│   │   ├── clientes/         # Cadastro de clientes + ficha
│   │   ├── obrigacoes/       # Obrigações e prazos
│   │   ├── processos/        # Processos administrativos
│   │   ├── agentes/          # Agentes Windows (saúde, versões)
│   │   ├── ia/               # OCR, classificação contábil, assistente
│   │   └── configuracoes/    # Usuários, plano de contas, integrações
│   │       └── <módulo>/
│   │           ├── components/  # Componentes da feature
│   │           ├── hooks/       # Hooks da feature
│   │           ├── api.ts       # Chamadas de API da feature
│   │           └── types.ts     # Tipos da feature (via index ou arquivo)
│   ├── lib/                  # api client, auth, utils, formatters
│   └── types/                # Tipos globais compartilhados
```

## Regras de arquitetura

1. **Uma feature nunca importa internos de outra** — só via `lib/` ou API
2. **Toda chamada HTTP passa pelo `lib/api.ts`** (token, erros, retry)
3. **Dados via TanStack Query** — sem `useEffect` + fetch manual espalhado
4. **Estado global só para o que é realmente global** (auth, tema) — Zustand
5. **Tipagem estrita** — nada de `any` fora de casos justificados
6. **Componentes de UI reutilizáveis ficam em `components/ui`** (shadcn)

## Tela de loading (identidade)

Substitui o efeito "túnel com partículas" do V3. Tela profissional com mensagens
sequenciais enquanto os módulos carregam:

```
Carregando módulos...
Carregando banco de dados...
Carregando componentes de IA...
```

## Identidade visual

Em definição via `referencias-design/`. Objetivo: bonito, confiável, robusto.

## Desenvolvimento

- Inicialmente em IP direto (sem DNS) até a UI estar pronta
- Depois: domínio próprio do produto + SSL (antes da demo de Dez)
- O V3 permanece no ar até o V4 substituí-lo completamente

## Roadmap relacionado (Linear)

- BAS-146 — Definição do Axon V4
- BAS-128 — Migração do banco para Supabase (paralela)
- BAS-131/132/133 — Módulos de IA (OCR, classificação, atendimento)
