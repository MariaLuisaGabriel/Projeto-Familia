# ADR-0002: TypeScript no Cliente, Servidor e Pacotes Compartilhados

- **Status:** Aceito
- **Contexto:** Os contratos de tipos de campo (`FieldTypeRegistry`) e validação de templates (`@estudos/template-schema`) devem rodar de forma idêntica no cliente e no servidor (R-21).
- **Decisão:** Utilizar TypeScript estrito em todos os pacotes (`packages/*`), módulos (`modules/*`) e aplicações (`apps/web`, `apps/api`, `apps/worker`).
- **Consequências:** Validação única compartilhada em `@estudos/registries` sem duplicação de regras entre frontend e backend.
