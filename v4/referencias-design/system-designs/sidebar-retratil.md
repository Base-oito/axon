# Sidebar Axon V4 — especificação (inspirada no Supabase)

> Decisão de design registrada em 07/08/2026 (Valdir).

## O que é

Menu lateral **retrátil** (collapse) no estilo do Supabase:

- **Estado expandido**: ícone + label da seção (ex: `📄 Documentos`)
- **Ao sair do menu com o mouse**: recolhe para **apenas ícones**
- **Hover em um ícone (recolhido)**: abre um **submenu flutuante** ao lado com as
  opções daquela seção/página

## Por que

- Elimina a necessidade de **abas** dentro das páginas — a navegação de segundo
  nível mora no submenu do sidebar
- Mais espaço vertical para o conteúdo
- Navegação limpa e profissional (padrão de SaaS moderno)

## Comportamento esperado

| Ação | Resultado |
|---|---|
| Mouse dentro do sidebar | Expandido (ícone + label) |
| Mouse sai do sidebar | Recolhido (só ícones) |
| Hover em ícone (recolhido) | Submenu flutuante ao lado com as opções da seção |
| Clique em item do submenu | Navega para a página (sem abas) |
| Tela pequena / mobile | Comportamento a definir (drawer?) |

## Estrutura de navegação prevista (esboço)

```
Documentos (NF-e, NFS-e, Relatórios, Eventos)
Chat (Conversas, IA de atendimento)
Dashboard (Visão geral)
Clientes (Cadastro, Fichas)
Obrigações (Calendário, Pendências)
Processos (Andamentos)
Agentes (Saúde, Versões)
IA (OCR, Classificação contábil)
Configurações (Usuários, Plano de contas, Integrações)
```

## Implementação

- Componente: `src/features/.../` ou `src/components/` — a definir no V4
- Estado: retrátil (mouse), submenu flutuante (hover), transições suaves
- Acessibilidade: foco via teclado, aria-expanded

## Status

- [x] Decisão registrada
- [ ] Implementar componente (próximo passo do V4)
- [ ] Validar UX com o Valdir (100% com a ideia)
