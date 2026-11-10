# ADR-0004: Eventos de Domínio + Transactional Outbox

- **Status:** Aceito
- **Contexto:** Efeitos colaterais entre módulos (ex.: tentativa registrada disparar regra ou atualizar analytics) não devem acoplar o módulo de origem nem rodar sobre mudanças não persistidas (R-08, R-27).
- **Decisão:** Gravar eventos de domínio imutáveis e versionados (`AttemptRegistered.v1`) na tabela `outbox` na mesma transação da mudança de estado.
- **Consequências:** Garantia de entrega at-least-once; exige que handlers em `rules` e `analytics` sejam idempotentes (R-28).
