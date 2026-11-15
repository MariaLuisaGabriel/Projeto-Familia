# Módulo `study`

Gerencia a árvore de conteúdo (disciplinas e tópicos), os itens de estudo (`StudyItem`) e a execução determinística dos geradores de cronograma (`linear`).

## Responsável por
- Árvore de disciplinas (`Subject`) e tópicos (`Topic`)
- Itens de estudo (`StudyItem`) e acompanhamento de conclusão
- Execução determinística de geradores de cronograma (`R-24`)

## Não é responsável por
- Questões, tentativas e repetição espaçada FSRS (→ módulo `practice`)
- Ocorrências e bloqueios na agenda (→ módulo `agenda`)

## Interface pública (`api.py`)
| Função / tipo | Caso de uso |
|---|---|
| `StudyItemRecord` | DTO representando um item de estudo planejado |
| `generate_linear_schedule` | Gera a sequência determinística de itens por semana (`R-24`) |
| `list_study_items` | Lista os itens de estudo do workspace ativo |
| `toggle_study_item` | Alterna a conclusão de um item de estudo |
| `run_linear_generator` | Regera o cronograma linear do workspace com o ritmo escolhido |
| `get_study_progress` | Retorna a contagem de itens concluídos e total |

## Tabelas que possui
Nenhuma ainda (serão criadas na Etapa 4 da Fase 0).

## Depende de
- `workspaces` (via `workspaces.api`): taxonomia e tipos de item do workspace

## Usado por
Nenhum módulo na Fase 0 (futuramente `practice` na Fase 2).

## Eventos
- **Emite:** `StudyItemCompleted.v1` (a partir da Fase 2)
- **Consome:** Nenhum.

## Registros usados
- `GeneratorRegistry` (`linear`) e `FieldTypeRegistry`.

## Decisões e regras relevantes
- R-24 (geradores determinísticos dado o mesmo estado e parâmetros)
- R-35 (isolamento de consultas por workspace)

## Onde começar a ler
1. `domain/study_plan.py`: algoritmo determinístico do gerador linear
2. `services/list_study_plan.py`: montagem do cronograma a partir da taxonomia do workspace
3. `views.py`: páginas e fragmentos HTMX de conclusão e geração
