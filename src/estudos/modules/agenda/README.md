# Módulo `agenda`

Gerencia os compromissos do estudante no calendário, com tipos de evento e campos customizados definidos pelos metadados do workspace (`EventType`). É o módulo de referência da Fase 0 (`R-56`).

## Responsável por
- Criação e listagem de ocorrências na agenda (`Event`)
- Renderização dinâmica de campos customizados por `EventType` (`R-42`, `R-43`)
- Validação dos valores de `custom_fields` contra o tipo configurado (`R-36`)
- Recorrência (`RRULE` RFC 5545) e exportação `.ics`

## Não é responsável por
- Decidir quando estudar ou gerar cronograma de tópicos (→ módulo `study`)
- Definição global de templates de área (→ módulo `workspaces`)

## Interface pública (`api.py`)
| Função / tipo | Caso de uso |
|---|---|
| `AgendaEventRecord` | DTO imutável representando uma ocorrência na agenda |
| `list_events` | Lista compromissos do workspace, opcionalmente filtrados por tipo |
| `create_event` | Cria um compromisso validando os campos customizados do seu `EventType` |
| `count_events_by_type` | Retorna a contagem de compromissos por tipo no workspace |

## Tabelas que possui
Nenhuma ainda (serão criadas na Etapa 3 da Fase 0).

## Depende de
- `workspaces` (via `workspaces.api`): obtenção do workspace ativo e seus `EventType`

## Usado por
- `study` (via `agenda.api`)

## Eventos
- **Emite:** `EventCreated.v1` (a partir da Fase 2)
- **Consome:** Nenhum.

## Registros usados
- `FieldTypeRegistry` (campos customizados de `EventType`)

## Decisões e regras relevantes
- R-42 e R-43 (formulários e filtros gerados a partir dos metadados do `EventType`)
- R-56 (módulo de referência simples e comentado na Fase 0)
- ADR-0008 (recorrência com RRULE)

## Onde começar a ler
1. `api.py`: fachada pública do módulo
2. `services/create_event.py`: criação de compromisso com validação de campos
3. `views.py`: páginas e fragmentos HTMX reutilizáveis (`R-61`)
