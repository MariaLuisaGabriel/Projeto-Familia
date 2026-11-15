# ADR-0011: Fila de jobs com Procrastinate sobre o Postgres

- **Status:** Aceito
- **Data:** 2026-11-12
- **Substitui:** [ADR-0005](./0005-pg-boss-fila-jobs.md)

## Contexto
O ADR-0005 escolheu pg-boss pelo princípio P6 (nenhuma infraestrutura além do Postgres). Com a mudança para Python (ADR-0009), pg-boss deixa de ser opção. A fila só é necessária a partir da Fase 2, junto com a outbox (ADR-0004).

## Decisão
Usar Procrastinate, fila de jobs em Python que usa o próprio PostgreSQL e tem integração com Django. O worker roda em processo separado, a partir de `src/estudos/worker/`, com o mesmo código da aplicação.

## Alternativas consideradas
- **Celery + Redis:** padrão de mercado, mas adiciona Redis (fere P6) e é mais pesado de operar.
- **django-q2 / Huey:** mais simples, mas com menos garantias transacionais com o Postgres.
- **Tarefas agendadas com cron + management commands:** suficiente para coisas periódicas, mas não para reagir a eventos.

## Consequências
- Nenhuma infraestrutura nova; jobs podem ser enfileirados na mesma transação da mudança, ou via `transaction.on_commit` (R-27).
- Entra na Fase 2. Até lá não há worker; efeitos entre módulos são síncronos e registrados como dívida (ARQUITETURA §4.4).
