# ADR-0012: "Hexagonal leve" dentro de cada módulo

- **Status:** Aceito
- **Data:** 2026-11-12
- **Complementa:** [ADR-0001](./0001-monolito-modular.md)

## Contexto
O ADR-0001 previa arquitetura hexagonal completa em cada módulo (`domain/`, `application/`, `adapters/`, portas e repositórios). Com Django (ADR-0009), repositórios abstratos sobre o ORM em todos os módulos viram cerimônia: duplicam o que o ORM já faz e escondem o código de quem o lê, sem ganho para uma equipe de 2 pessoas.

## Decisão
Cada módulo é um app Django com `domain/` (Python puro, só onde há lógica real: geradores, FSRS, motor de regras, validação de templates), `services/` (um caso de uso por arquivo, usando os models diretamente), `models.py`, `views.py` e uma interface pública em `api.py`. O `__init__.py` fica vazio, porque o Django o importa antes de os models estarem prontos.

## Alternativas consideradas
- **Hexagonal completo (ADR-0001 original):** isolamento máximo, mas muito código de passagem para pouco benefício nesta escala.
- **Django "padrão" (lógica em models e views):** mais rápido no começo, mas a lógica de negócio se espalha e as fronteiras entre módulos somem.

## Consequências
- Fronteiras verificadas por import-linter e por `tests/architecture/test_module_matrix.py` (R-01 a R-06).
- O risco típico é lógica escorrendo para models e views (ARQUITETURA §13.2); a revisão de PR cobra isso.
- Se algum módulo precisar trocar de persistência ou ter testes sem banco em larga escala, ele pode introduzir repositório próprio sem afetar os demais.
