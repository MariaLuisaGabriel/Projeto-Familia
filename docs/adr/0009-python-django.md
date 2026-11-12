# ADR-0009: Python e Django em todo o sistema

- **Status:** Aceito
- **Data:** 2026-11-12
- **Substitui:** [ADR-0002](./0002-typescript-fullstack.md)

## Contexto
A v0.2 previa TypeScript em cliente, servidor e pacotes compartilhados, principalmente para que a validação dos campos customizados rodasse igual nos dois lados (R-21). A equipe tem 2 desenvolvedores, há clientes reais desde o primeiro deploy e a preferência da equipe é Python. O protótipo em TypeScript (tag `prototipo-ts`) não tinha persistência nem autenticação reais.

## Decisão
Escrever o sistema em Python 3.14+ com Django 5. Contas com `django.contrib.auth` (model de usuário próprio, R-63) e `django-allauth`. Ferramentas: uv, ruff, pyright com `django-types`, pytest, Hypothesis e import-linter.

## Alternativas consideradas
- **Manter TypeScript (Fastify/NestJS + React):** dois runtimes de tela e servidor, build de frontend e mais peças para 2 pessoas manterem; auth, admin e migrações teriam de ser montados à mão.
- **FastAPI + frontend separado:** bom para API, mas exigiria frontend próprio e montar contas, sessão, admin e migrações; o produto é principalmente telas e formulários.

## Consequências
- Validação definida uma vez em Python (R-21); como as telas são renderizadas no servidor, não há duplicação.
- Contas, sessão, admin e migrações vêm prontos.
- Novo princípio P7 (uma linguagem) e regra R-60 limitando JavaScript.
- Python 3.14+ permite usar `uuid.uuid7()` da biblioteca padrão (R-34), sem dependência extra.
- Se surgir app nativo, a API será Django Ninja sobre os mesmos serviços.
