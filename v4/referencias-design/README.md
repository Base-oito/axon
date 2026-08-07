# Referências de Design — Axon V4

Esta pasta guarda exemplos visuais e system designs para definir a identidade
do front novo. A ideia: **bonito, confiável, robusto** — produto, não sistema interno.

## Como usar

1. Coloque screenshots/links em `sites/` (ex: dashboard de produtos que você admira)
2. Documente os system designs (cores, tipografia, tokens) em `system-designs/`
3. Cada referência deve ter um comentário: o que gostou, o que levar para o Axon

## O que procurar (checklist de avaliação)

- **Dashboard**: densidade de informação sem poluição, hierarquia visual clara
- **Tabelas**: filtros, ordenação, estados (carregando/vazio/erro), densidade
- **Chat**: conforto para conversas longas, indicadores de digitando/não lida
- **Formulários**: foco, validação inline, progresso em fluxos longos
- **Loading**: o que faz o usuário sentir "está trabalhando" (ex: etapas nomeadas)
- **Empty states**: o que aparece quando não há dados (deve orientar o próximo passo)
- **Dark mode**: o V3 usa tema escuro — manter ou evoluir

## Referência inicial

- Loading screen: mensagens sequenciais ("Carregando módulos…", "Carregando banco
  de dados…", "Carregando componentes de IA…") — já esboçada em `src/app/LoadingScreen.tsx`
