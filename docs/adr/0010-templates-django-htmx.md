# ADR-0010: Interface com templates Django e HTMX

- **Status:** Aceito
- **Data:** 2026-11-12

## Contexto
A interface é composta principalmente por formulários, listas e agenda, com campos gerados a partir dos metadados dos templates de área (R-42). Com a decisão por Python (ADR-0009), um frontend SPA exigiria uma segunda linguagem, build de JavaScript e uma API para cada tela.

## Decisão
Renderizar as telas no servidor com templates Django e usar HTMX para atualizações parciais. O HTMX é copiado para `ui/static/` com versão fixada no nome do arquivo. O único outro JavaScript permitido é o service worker da PWA e pequenos scripts sem build (R-60).

## Alternativas consideradas
- **React/Vue com API JSON:** interatividade maior, mas dobra a quantidade de código (API + telas), traz build de JS e duplica validação.
- **Django puro, sem HTMX:** mais simples ainda, mas cada interação recarregaria a página inteira, o que é ruim no celular.

## Consequências
- Cada tipo de campo tem validador e fragmento HTML no mesmo lugar do registro (ARQUITETURA §7.1).
- Fragmentos HTMX reutilizam os templates das páginas completas (R-61); CSRF vai no cabeçalho, configurado no layout base (R-62); URLs sempre por nome (R-65).
- Offline de escrita fica difícil; na Fase 0 o offline é só cache de leitura (R-46). Se virar necessidade, a saída é uma tela isolada com JavaScript mínimo, por ADR.
