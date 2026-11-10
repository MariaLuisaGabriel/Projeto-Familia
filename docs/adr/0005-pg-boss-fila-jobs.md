# ADR-0005: Fila de Jobs com pg-boss sobre o Próprio PostgreSQL

- **Status:** Aceito
- **Contexto:** O princípio P6 exige simplicidade operacional (um deploy, um banco, sem infraestrutura extra como Redis/RabbitMQ até que métricas reais justifiquem).
- **Decisão:** Utilizar `pg-boss` sobre o próprio PostgreSQL para agendamento e processamento assíncrono em `apps/worker`.
- **Consequências:** Zero infraestrutura adicional mantendo semântica transacional com o banco principal.
