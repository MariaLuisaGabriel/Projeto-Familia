# Arquitetura da Plataforma de Estudos

> **Status:** rascunho v0.2 · **Escopo:** estágio inicial (MVP até templates compartilháveis)
> Este documento define como o sistema é organizado, quais regras todo código deve seguir e quais limites a customização tem. Mudanças nele exigem um ADR (ver §15).

As palavras **DEVE**, **NÃO DEVE**, **DEVERIA** e **PODE** seguem o sentido da RFC 2119: **DEVE** é obrigatório e verificado em CI sempre que possível; **DEVERIA** é o padrão, com exceções justificadas em ADR.

---

## 1. Propósito e visão

A plataforma ajuda pessoas a organizar a vida de estudos: compromissos de aula, revisões, prática de questões, anotações e metas. O diferencial é se adaptar à área de cada pessoa por meio de **templates** — um estudante de medicina marca plantões, um concurseiro marca simulados e acompanha o edital, um estudante de biologia marca saídas de campo.

A tese desta arquitetura é que **esses conceitos viram dados, definidos por templates, sobre um núcleo genérico**.

---

## 2. Princípios

- **P1 — Núcleo pequeno, metadados ricos.** O núcleo conhece apenas conceitos que servem a qualquer estudante. Tudo que é específico de uma área vive em templates.
- **P2 — Customização por combinação, nunca por programação.** Usuários combinam peças de catálogos fechados (tipos de campo, geradores, gatilhos, ações, widgets). Usuários não escrevem código.
- **P3 — Aberto para extensão, fechado para modificação.** Adicionar um tipo de campo, gerador ou ação é criar uma implementação e registrá-la. Nenhum outro arquivo do sistema deveria precisar mudar.
- **P4 — Fronteiras explícitas e verificadas.** Módulos só se comunicam por interface pública ou evento de domínio. Violações quebram o build.
- **P5 — Os dados do usuário são dele.** Nenhuma atualização de template sobrescreve customizações. Nada é apagado sem ação explícita. Tudo é exportável.
- **P6 — Simplicidade operacional.** Um deploy, um banco, nenhuma infraestrutura extra até que uma métrica real justifique.

---

## 3. Visão geral da arquitetura

**Estilo:** monolito modular, com arquitetura hexagonal (portas e adaptadores) dentro de cada módulo, orientado a metadados e com pontos de extensão baseados em registros.

| Decisão | Escolha | ADR |
| :--- | :--- | :--- |
| Estilo | Monolito modular | [ADR-0001](./adr/0001-monolito-modular.md) |
| Linguagem | TypeScript em cliente, servidor e pacotes compartilhados | [ADR-0002](./adr/0002-typescript-fullstack.md) |
| Banco | PostgreSQL, campos customizados em JSONB | [ADR-0003](./adr/0003-postgresql-jsonb.md) |
| Comunicação interna assíncrona | Eventos de domínio + Transactional Outbox | [ADR-0004](./adr/0004-eventos-dominio-transactional-outbox.md) |
| Fila de jobs | pg-boss sobre o próprio Postgres | [ADR-0005](./adr/0005-pg-boss-fila-jobs.md) |
| Instanciação de template | Cópia versionada (não referência viva) | [ADR-0006](./adr/0006-instanciacao-template-copia-versionada.md) |
| Repetição espaçada | FSRS | [ADR-0007](./adr/0007-repeticao-espacada-fsrs.md) |
| Recorrência de eventos | RRULE (RFC 5545) + exceções | [ADR-0008](./adr/0008-recorrencia-rrule-rfc5545.md) |

---

## 4. Módulos e fronteiras

| Módulo | Responsável por | Não é responsável por |
| :--- | :--- | :--- |
| `identity` | Contas, autenticação, sessão, papéis no workspace | Preferências de estudo |
| `workspaces` | Workspaces, templates, versões, instanciação, metadados (tipos, campos, widgets) | Os dados que os tipos descrevem |
| `calendar` | Eventos, recorrência, bloqueios de período, exportação `.ics` | Decidir quando estudar |
| `study` | Disciplinas, tópicos, itens de estudo (revisões, leituras), geradores de cronograma | Questões e tentativas |
| `practice` | Questões, tentativas, cartões e agendamento FSRS | Estatísticas agregadas |
| `notes` | Anotações em Markdown e vínculos com outras entidades | Conteúdo de questões |
| `rules` | Avaliação e execução de regras do usuário | Lógica de negócio dos outros módulos |
| `analytics` | Projeções e agregações para widgets e relatórios | Escrita em dados de outros módulos |

### Regras de dependência (R-01 a R-09)
- **R-01:** `domain/` NÃO DEVE importar nada de `application/`, `adapters/`, `packages/db` ou bibliotecas de infraestrutura.
- **R-02:** `application/` NÃO DEVE importar de `adapters/`. Depende apenas de portas (interfaces).
- **R-03:** Um módulo NÃO DEVE importar arquivos internos de outro módulo. Apenas o `index.ts` público.
- **R-04:** Um módulo NÃO DEVE ler ou escrever tabelas pertencentes a outro módulo.
- **R-05:** O grafo de dependências entre módulos DEVE ser acíclico e seguir a matriz de dependências.
- **R-06:** `packages/core` e `packages/registries` NÃO DEVEM depender de nenhum módulo.
- **R-07:** Chamadas síncronas entre módulos DEVEM passar pela interface pública e acontecer dentro do mesmo processo.
- **R-08:** Efeitos colaterais em outro módulo DEVEM acontecer por evento de domínio, não por chamada direta do módulo de origem.
- **R-09:** Eventos de domínio DEVEM ser imutáveis, versionados (`AttemptRegistered.v1`) e carregar `workspace_id`, `occurred_at`, `causation_id` e `correlation_id`.
