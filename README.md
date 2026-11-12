# Estudos

Plataforma de organização de estudos customizável por **templates de área** (residência médica, concurso público, graduação). Conceitos como "plantão" ou "simulado" não estão no código: são dados, definidos por templates, sobre um núcleo genérico.

Python + Django + HTMX, PostgreSQL. Arquitetura em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Rodar em 5 minutos

**Pré-requisitos:** [uv](https://docs.astral.sh/uv/), Docker (para o Postgres) e `make`. O uv instala o Python certo (3.14+) sozinho.

```bash
cp .env.example .env      # ajuste se quiser; os padrões funcionam localmente
make install              # dependências
make dev                  # sobe o Postgres, aplica migrações e roda o servidor
```

Abra http://localhost:8000, crie uma conta e confirme o e-mail pelo link que aparece **no terminal** (em desenvolvimento os e-mails não são enviados).

Para o admin: `uv run python manage.py createsuperuser` e acesse `/admin/`.

## Comandos

```bash
make help     # lista tudo
make check    # o mesmo que o CI: lint, tipos, fronteiras e testes
make fmt      # formata e aplica correções automáticas
make test     # só os testes
make arch     # só as fronteiras entre módulos (import-linter)
```

## Onde está o quê

| Pasta | Conteúdo |
|---|---|
| `src/estudos/modules/` | Módulos de negócio. Cada um tem um `README.md`; comece por ele |
| `src/estudos/core/` | Python puro: ids, erros |
| `src/estudos/registries/`, `template_schema/` | Catálogos de extensão e formato dos templates de área |
| `src/estudos/ui/` | Layout base, CSS, HTMX |
| `area_templates/` | Templates de área (dados, não código) |
| `tests/architecture/` | Verificações automáticas das regras da arquitetura |
| `docs/` | Arquitetura, ADRs, roadmap, guias |

## Contribuindo

Leia o [`CONTRIBUTING.md`](CONTRIBUTING.md): fluxo de branch e PR, convenções de código e definição de pronto. O plano das próximas entregas está em [`docs/produto/roadmap.md`](docs/produto/roadmap.md).

O protótipo anterior em TypeScript está preservado na tag `prototipo-ts`.
