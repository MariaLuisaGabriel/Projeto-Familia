# ADR-0008: Recorrência de Eventos com RRULE (RFC 5545) + Exceções

- **Status:** Aceito
- **Contexto:** Eventos de estudo e compromissos frequentemente se repetem semanalmente ou em padrões específicos, com ocasionais exceções de datas.
- **Decisão:** Armazenar a regra de recorrência no padrão RFC 5545 (`rrule`) acompanhada da lista de datas excluídas (`rrule_exceptions`), facilitando também a exportação direta para `.ics`.
- **Consequências:** Compatibilidade nativa com clientes de calendário externos (iCalendar) e cálculo consistente no fuso horário do workspace (`America/Sao_Paulo` — R-40).
